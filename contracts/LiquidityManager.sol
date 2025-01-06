// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiquisityManager is Ownable{
    IUniswapV2Router02 public uniswapRouter;
    address public NGNA;
    address public DAI;
    address[] public path;

    constructor(
        address _uniswapRouter,
        address _NGNA,
        address _USDT
    ) {
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        NGNA = _NGNA;
        DAI = _DAI;
    }

    
    function adjustPrice(uint256 newPrice) external onlyOwner {
    uint256 currentPrice = getPoolPrice(); // Fetch current pool price
    require(newPrice > 0, "Invalid new price");

    if (currentPrice < newPrice) {
        // NGNA undervalued: Swap USDT for NGNA
        uint256 amountToSwap = calculateSwapAmount(currentPrice, newPrice);
        uniswapRouter.swapExactTokensForTokens(
            amountToSwap,
            0,
            pathUSDTtoNGNA(),
            address(this),
            block.timestamp
        );
    } else if (currentPrice > newPrice) {
        // NGNA overvalued: Swap NGNA for USDT
        uint256 amountToSwap = calculateSwapAmount(newPrice, currentPrice);
        uniswapRouter.swapExactTokensForTokens(
            amountToSwap,
            0,
            pathDAItoNGNA(),
            address(this),
            block.timestamp
        );
    }
    }

    function getPoolPrice() public view returns (uint256) {
        (uint256 reserveNGNA, uint256 reserveDAI, ) = IUniswapV2Pair(pairAddress()).getReserves();
        return (reserveDAI * 1e18) / reserveNGNA;
    }


    function calculateSwapAmount(uint256 currentPrice, uint256 targetPrice) internal pure returns (uint256) {
        return (currentPrice - targetPrice) / currentPrice;
    }

    function pathDAItoNGNA() internal view returns (address[] memory) {
        address;
        path[0] = DAI;
        path[1] = NGNA;
        return path;
    }

    function pathNGNAtoDAI() internal view returns (address[] memory) {
        address;
        path[0] = NGNA;
        path[1] = DAI;
        return path;
    }
}