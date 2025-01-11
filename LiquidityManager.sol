
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiquidityManager is Ownable {
    IUniswapV2Router02 public uniswapRouter;
    address public NGNA;
    address public DAI;
    address public uniswapFactory;
   //ddress[] public path;

    constructor(
        address _uniswapRouter,
        address _uniswapFactory,
        address _NGNA,
        address _DAI
    ) Ownable(msg.sender) {
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        uniswapFactory = _uniswapFactory;
        NGNA = _NGNA;
        DAI = _DAI;
    }

    function adjustPrice(uint256 newPrice) external onlyOwner {
        uint256 currentPrice = getPoolPrice(); // Fetch current pool price
        require(newPrice > 0, "Invalid new price");

        if (currentPrice < newPrice) {
            // NGNA undervalued: Swap DAI for NGNA
            uint256 amountToSwap = calculateSwapAmount(currentPrice, newPrice);
            IERC20(DAI).approve(address(this), amountToSwap);
            IERC20(NGNA).approve(address(this), amountToSwap);
            address[] memory path;  
            path = new address[](2);
            path[0] = DAI;
            path[1] = NGNA;
            uniswapRouter.swapExactTokensForTokens(
                amountToSwap,
                0,
                path,
                address(this),
                block.timestamp
            );
        } else if (currentPrice > newPrice) {
            // NGNA overvalued: Swap NGNA for DAI
            uint256 amountToSwap = calculateSwapAmount(newPrice, currentPrice);
            address[] memory path;
            path = new address[](2);
            path[0] = NGNA;
            path[1] = DAI;
            uniswapRouter.swapExactTokensForTokens(
                amountToSwap,
                0,
                path,
                address(this),
                block.timestamp
            );
        }
    }

    function getPoolPrice() public view returns (uint256) {
        address pair = pairAddress();
        (uint256 reserveNGNA, uint256 reserveDAI, ) = IUniswapV2Pair(pair).getReserves();
        return reserveNGNA / reserveDAI;
    }

    function calculateSwapAmount(uint256 currentPrice, uint256 targetPrice) public view returns (uint256) {
    // Fetch reserves from the liquidity pool
    (uint256 reserveNGNA, uint256 reserveDAI, ) = IUniswapV2Pair(pairAddress()).getReserves();

    // Ensure the price difference is positive
    require(currentPrice != targetPrice, "Prices are the same, no swap needed");
    
    uint256 priceDifference = currentPrice > targetPrice ? currentPrice - targetPrice : targetPrice - currentPrice;
    
    // Calculate the price impact based on the price difference
    uint256 swapAmount;

    if (currentPrice < targetPrice) {
        // If NGNA is undervalued, swap DAI for NGNA
        swapAmount = (reserveDAI * priceDifference) / currentPrice;  // Price impact on DAI
        // Ensure the swap amount doesn't exceed available liquidity in the pool
        if (swapAmount > reserveDAI) {
            swapAmount = reserveDAI; // Limit the amount to available DAI
        }
    } else {
        // If NGNA is overvalued, swap NGNA for DAI
        swapAmount = (reserveNGNA * priceDifference) / targetPrice;  // Price impact on NGNA
        // Ensure the swap amount doesn't exceed available liquidity in the pool
        if (swapAmount > reserveNGNA) {
            swapAmount = reserveNGNA; // Limit the amount to available NGNA
        }
    }

    return swapAmount;
    }


    function pairAddress() public view returns (address) {
        return IUniswapV2Factory(uniswapFactory).getPair(NGNA, DAI);
    }
}
