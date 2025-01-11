// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAIToken is ERC20, Ownable {
    address public custodian;

    constructor() ERC20("DAI Token", "DAI") Ownable(msg.sender){
        custodian = msg.sender; // Initially set to contract deployer
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function updateCustodian(address newCustodian) external onlyOwner {
        custodian = newCustodian;
    }
}
