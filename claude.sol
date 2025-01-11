// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiquidityManager is Ownable {
    IUniswapV2Router02 public immutable uniswapRouter;
    address public immutable NGNA;
    address public immutable DAI;
    address public immutable uniswapFactory;

    // Events for better transparency and monitoring
    event PriceAdjustment(uint256 oldPrice, uint256 newPrice, uint256 amountSwapped);
    event SwapExecuted(address fromToken, address toToken, uint256 amountIn, uint256 amountOut);

    constructor(
        address _uniswapRouter,
        address _uniswapFactory,
        address _NGNA,
        address _DAI,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_uniswapRouter != address(0), "Invalid router address");
        require(_uniswapFactory != address(0), "Invalid factory address");
        require(_NGNA != address(0), "Invalid NGNA address");
        require(_DAI != address(0), "Invalid DAI address");
        
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        uniswapFactory = _uniswapFactory;
        NGNA = _NGNA;
        DAI = _DAI;
    }

    function adjustPrice(uint256 newPrice) external onlyOwner {
        uint256 currentPrice = getPoolPrice();
        require(newPrice > 0, "Invalid new price");
        require(currentPrice > 0, "Invalid current price");

        uint256 amountToSwap;
        address[] memory path = new address[](2);

        if (currentPrice < newPrice) {
            // NGNA undervalued: Swap DAI for NGNA
            path[0] = DAI;
            path[1] = NGNA;
            amountToSwap = calculateSwapAmount(currentPrice, newPrice);
            
            require(IERC20(DAI).approve(address(uniswapRouter), amountToSwap), "DAI approval failed");
            
            uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
                amountToSwap,
                0, // Accept any amount of NGNA
                path,
                address(this),
                block.timestamp
            );
            
            emit SwapExecuted(DAI, NGNA, amounts[0], amounts[1]);
        } else if (currentPrice > newPrice) {
            // NGNA overvalued: Swap NGNA for DAI
            path[0] = NGNA;
            path[1] = DAI;
            amountToSwap = calculateSwapAmount(newPrice, currentPrice);
            
            require(IERC20(NGNA).approve(address(uniswapRouter), amountToSwap), "NGNA approval failed");
            
            uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
                amountToSwap,
                0, // Accept any amount of DAI
                path,
                address(this),
                block.timestamp
            );
            
            emit SwapExecuted(NGNA, DAI, amounts[0], amounts[1]);
        }

        emit PriceAdjustment(currentPrice, newPrice, amountToSwap);
    }

    function getPoolPrice() public view returns (uint256) {
        address pair = pairAddress();
        require(pair != address(0), "Pool does not exist");
        
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair).getReserves();
        
        // Ensure we're using the correct reserves based on token order
        (uint256 reserveNGNA, uint256 reserveDAI) = NGNA < DAI 
            ? (reserve0, reserve1) 
            : (reserve1, reserve0);
            
        require(reserveNGNA > 0, "No NGNA liquidity");
        return (reserveDAI * 1e18) / reserveNGNA;
    }

    function calculateSwapAmount(
        uint256 currentPrice, 
        uint256 targetPrice
    ) internal pure returns (uint256) {
        require(currentPrice != targetPrice, "Prices are equal");
        
        // Improved calculation to determine optimal swap amount
        uint256 priceDiff = currentPrice > targetPrice 
            ? currentPrice - targetPrice 
            : targetPrice - currentPrice;
            
        return (priceDiff * 1e18) / currentPrice;
    }

    function pairAddress() public view returns (address) {
        return IUniswapV2Factory(uniswapFactory).getPair(NGNA, DAI);
    }

    // Emergency withdraw function
    function withdrawToken(
        address token,
        uint256 amount
    ) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "Transfer failed");
    }
}

---------------------------------------------------------------
