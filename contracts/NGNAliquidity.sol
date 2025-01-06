// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiquidityManager is Ownable {
    IUniswapV2Router02 public uniswapRouter;
    address public NGNA;
    address public USDT;
    address public DAI;

    constructor(
        address _uniswapRouter,
        address _NGNA,
        address _USDT,
        address _DAI
    ) {
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        NGNA = _NGNA;
        USDT = _USDT;
        DAI = _DAI;
    }

    function addLiquidityNGNAUSDT(uint256 ngnaAmount, uint256 usdtAmount) external onlyOwner {
        IERC20(NGNA).transferFrom(msg.sender, address(this), ngnaAmount);
        IERC20(USDT).transferFrom(msg.sender, address(this), usdtAmount);

        IERC20(NGNA).approve(address(uniswapRouter), ngnaAmount);
        IERC20(USDT).approve(address(uniswapRouter), usdtAmount);

        uniswapRouter.addLiquidity(
            NGNA,
            USDT,
            ngnaAmount,
            usdtAmount,
            1, // Min NGNA
            1, // Min USDT
            owner(),
            block.timestamp
        );
    }

    function addLiquidityNGNADAI(uint256 ngnaAmount, uint256 daiAmount) external onlyOwner {
        IERC20(NGNA).transferFrom(msg.sender, address(this), ngnaAmount);
        IERC20(DAI).transferFrom(msg.sender, address(this), daiAmount);

        IERC20(NGNA).approve(address(uniswapRouter), ngnaAmount);
        IERC20(DAI).approve(address(uniswapRouter), daiAmount);

        uniswapRouter.addLiquidity(
            NGNA,
            DAI,
            ngnaAmount,
            daiAmount,
            1, // Min NGNA
            1, // Min DAI
            owner(),
            block.timestamp
        );
    }
}
