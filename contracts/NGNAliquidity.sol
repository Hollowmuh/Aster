// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AddLiquidity is Ownable, ReentrancyGuard {
    IUniswapV2Router02 public immutable uniswapRouter;
    address public immutable NGNA;
    address public immutable USDT;
    address public immutable DAI;

    // Events
    event LiquidityAdded(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event EmergencyWithdraw(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    constructor(
        address _uniswapRouter,
        address _NGNA,
        address _USDT,
        address _DAI
    ) Ownable(msg.sender) {
        require(_uniswapRouter != address(0), "Invalid router address");
        require(_NGNA != address(0), "Invalid NGNA address");
        require(_USDT != address(0), "Invalid USDT address");
        require(_DAI != address(0), "Invalid DAI address");

        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        NGNA = _NGNA;
        USDT = _USDT;
        DAI = _DAI;
    }

    /**
     * @notice Add liquidity to NGNA/USDT pool
     * @param ngnaAmount Amount of NGNA tokens to add
     * @param usdtAmount Amount of USDT tokens to add
     * @param minNGNA Minimum amount of NGNA to add as liquidity
     * @param minUSDT Minimum amount of USDT to add as liquidity
     */
    function addLiquidityNGNAUSDT(
        uint256 ngnaAmount,
        uint256 usdtAmount,
        uint256 minNGNA,
        uint256 minUSDT
    ) external onlyOwner nonReentrant {
        require(ngnaAmount > 0 && usdtAmount > 0, "Amounts must be greater than 0");
        require(minNGNA > 0 && minUSDT > 0, "Minimum amounts must be greater than 0");

        // Transfer tokens to contract
        require(
            IERC20(NGNA).transferFrom(msg.sender, address(this), ngnaAmount),
            "NGNA transfer failed"
        );
        require(
            IERC20(USDT).transferFrom(msg.sender, address(this), usdtAmount),
            "USDT transfer failed"
        );

        // Approve router to spend tokens
        require(
            IERC20(NGNA).approve(address(uniswapRouter), ngnaAmount),
            "NGNA approval failed"
        );
        require(
            IERC20(USDT).approve(address(uniswapRouter), usdtAmount),
            "USDT approval failed"
        );

        // Add liquidity
        (uint256 amountNGNA, uint256 amountUSDT, uint256 liquidity) = uniswapRouter.addLiquidity(
            NGNA,
            USDT,
            ngnaAmount,
            usdtAmount,
            minNGNA,
            minUSDT,
            owner(),
            block.timestamp
        );

        // Refund excess tokens if any
        if (ngnaAmount > amountNGNA) {
            require(
                IERC20(NGNA).transfer(msg.sender, ngnaAmount - amountNGNA),
                "NGNA refund failed"
            );
        }
        if (usdtAmount > amountUSDT) {
            require(
                IERC20(USDT).transfer(msg.sender, usdtAmount - amountUSDT),
                "USDT refund failed"
            );
        }

        emit LiquidityAdded(NGNA, USDT, amountNGNA, amountUSDT, liquidity);
    }

    /**
     * @notice Add liquidity to NGNA/DAI pool
     * @param ngnaAmount Amount of NGNA tokens to add
     * @param daiAmount Amount of DAI tokens to add
     * @param minNGNA Minimum amount of NGNA to add as liquidity
     * @param minDAI Minimum amount of DAI to add as liquidity
     */
    function addLiquidityNGNADAI(
        uint256 ngnaAmount,
        uint256 daiAmount,
        uint256 minNGNA,
        uint256 minDAI
    ) external onlyOwner nonReentrant {
        require(ngnaAmount > 0 && daiAmount > 0, "Amounts must be greater than 0");
        require(minNGNA > 0 && minDAI > 0, "Minimum amounts must be greater than 0");

        // Transfer tokens to contract
        require(
            IERC20(NGNA).transferFrom(msg.sender, address(this), ngnaAmount),
            "NGNA transfer failed"
        );
        require(
            IERC20(DAI).transferFrom(msg.sender, address(this), daiAmount),
            "DAI transfer failed"
        );

        // Approve router to spend tokens
        require(
            IERC20(NGNA).approve(address(uniswapRouter), ngnaAmount),
            "NGNA approval failed"
        );
        require(
            IERC20(DAI).approve(address(uniswapRouter), daiAmount),
            "DAI approval failed"
        );

        // Add liquidity
        (uint256 amountNGNA, uint256 amountDAI, uint256 liquidity) = uniswapRouter.addLiquidity(
            NGNA,
            DAI,
            ngnaAmount,
            daiAmount,
            minNGNA,
            minDAI,
            owner(),
            block.timestamp
        );

        // Refund excess tokens if any
        if (ngnaAmount > amountNGNA) {
            require(
                IERC20(NGNA).transfer(msg.sender, ngnaAmount - amountNGNA),
                "NGNA refund failed"
            );
        }
        if (daiAmount > amountDAI) {
            require(
                IERC20(DAI).transfer(msg.sender, daiAmount - amountDAI),
                "DAI refund failed"
            );
        }

        emit LiquidityAdded(NGNA, DAI, amountNGNA, amountDAI, liquidity);
    }

    /**
     * @notice Emergency withdraw tokens from the contract
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        require(
            IERC20(token).transfer(owner(), amount),
            "Token transfer failed"
        );

        emit EmergencyWithdraw(token, owner(), amount);
    }
}