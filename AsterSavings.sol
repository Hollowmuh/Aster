// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AsterFinance
 * @dev Main contract for ASTER FINANCE education savings and loan platform
 */
contract AsterFinance is Ownable, ReentrancyGuard {
    IERC20 public daiToken;
    
    struct SavingsAccount {
        uint256 balance;          // Current savings balance
        uint256 matchedAmount;    // Amount received in matching funds
        uint256 lastDeposit;      // Timestamp of last deposit
        uint256 savingsStreak;    // Consecutive months with deposits
        bool isActive;            // Account status
        uint256 loanEligibility;  // Amount user is eligible to borrow
    }
    
    struct MatchingPartner {
        address addr;             // Partner's address
        uint256 matchRate;        // Match percentage (in basis points, 100 = 1%)
        uint256 maxMatchAmount;   // Maximum amount to match per user
        bool isActive;            // Partner status
    }
    
    // Main storage
    mapping(address => SavingsAccount) public savingsAccounts;
    mapping(address => MatchingPartner) public matchingPartners;
    address[] public activePartners;
    
    // Platform settings
    uint256 public minimumSavingsPeriod = 3 months;    // Minimum time before loan eligibility
    uint256 public minimumMonthlyDeposit = 10 ether;   // Minimum monthly deposit (in DAI)
    uint256 public loanEligibilityThreshold = 30;      // Percentage of tuition needed in savings
    
    // Events
    event AccountCreated(address indexed user);
    event DepositMade(address indexed user, uint256 amount);
    event MatchingReceived(address indexed user, address indexed partner, uint256 amount);
    event LoanEligibilityUpdated(address indexed user, uint256 newEligibility);
    event PartnerAdded(address indexed partner, uint256 matchRate);
    event PartnerRemoved(address indexed partner);
    
    constructor(address _daiToken) Ownable(msg.sender) {
        daiToken = IERC20(_daiToken);
    }
    
    /**
     * @dev Creates a new savings account
     */
    function createAccount() external {
        require(!savingsAccounts[msg.sender].isActive, "Account already exists");
        
        savingsAccounts[msg.sender] = SavingsAccount({
            balance: 0,
            matchedAmount: 0,
            lastDeposit: 0,
            savingsStreak: 0,
            isActive: true,
            loanEligibility: 0
        });
        
        emit AccountCreated(msg.sender);
    }
    
    /**
     * @dev Processes a deposit and matching funds
     * @param amount Amount to deposit in DAI
     */
    function deposit(uint256 amount) external nonReentrant {
        require(savingsAccounts[msg.sender].isActive, "Account not active");
        require(amount >= minimumMonthlyDeposit, "Below minimum deposit");
        
        // Transfer DAI from user
        require(daiToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // Update savings account
        SavingsAccount storage account = savingsAccounts[msg.sender];
        account.balance += amount;
        
        // Update savings streak
        if (account.lastDeposit == 0 || 
            block.timestamp >= account.lastDeposit + 28 days &&
            block.timestamp <= account.lastDeposit + 32 days) {
            account.savingsStreak++;
        } else if (block.timestamp > account.lastDeposit + 32 days) {
            account.savingsStreak = 1;
        }
        account.lastDeposit = block.timestamp;
        
        // Process matching from partners
        _processMatching(msg.sender, amount);
        
        // Update loan eligibility
        _updateLoanEligibility(msg.sender);
        
        emit DepositMade(msg.sender, amount);
    }
    
    /**
     * @dev Internal function to process matching funds from partners
     */
    function _processMatching(address user, uint256 depositAmount) internal {
        SavingsAccount storage account = savingsAccounts[user];
        
        for (uint i = 0; i < activePartners.length; i++) {
            MatchingPartner storage partner = matchingPartners[activePartners[i]];
            if (!partner.isActive) continue;
            
            uint256 matchAmount = (depositAmount * partner.matchRate) / 10000;
            if (matchAmount > partner.maxMatchAmount) {
                matchAmount = partner.maxMatchAmount;
            }
            
            if (matchAmount > 0 && 
                daiToken.transferFrom(partner.addr, address(this), matchAmount)) {
                account.matchedAmount += matchAmount;
                account.balance += matchAmount;
                emit MatchingReceived(user, partner.addr, matchAmount);
            }
        }
    }
    
    /**
     * @dev Internal function to update loan eligibility based on savings history
     */
    function _updateLoanEligibility(address user) internal {
        SavingsAccount storage account = savingsAccounts[user];
        
        if (block.timestamp >= account.lastDeposit + minimumSavingsPeriod &&
            account.savingsStreak >= 3) {
            
            // Calculate loan eligibility as a multiple of savings
            uint256 savingsPercent = (account.balance * 100) / minimumMonthlyDeposit;
            if (savingsPercent >= loanEligibilityThreshold) {
                // Eligible for 2x their savings as a loan
                account.loanEligibility = account.balance * 2;
                emit LoanEligibilityUpdated(user, account.loanEligibility);
            }
        }
    }
    
    /**
     * @dev Adds a new matching partner
     */
    function addMatchingPartner(
        address partner,
        uint256 matchRate,
        uint256 maxMatchAmount
    ) external onlyOwner {
        require(partner != address(0), "Invalid partner address");
        require(matchRate > 0 && matchRate <= 10000, "Invalid match rate");
        
        matchingPartners[partner] = MatchingPartner({
            addr: partner,
            matchRate: matchRate,
            maxMatchAmount: maxMatchAmount,
            isActive: true
        });
        activePartners.push(partner);
        
        emit PartnerAdded(partner, matchRate);
    }
    
    /**
     * @dev Removes a matching partner
     */
    function removeMatchingPartner(address partner) external onlyOwner {
        require(matchingPartners[partner].isActive, "Partner not active");
        matchingPartners[partner].isActive = false;
        
        // Remove from active partners array
        for (uint i = 0; i < activePartners.length; i++) {
            if (activePartners[i] == partner) {
                activePartners[i] = activePartners[activePartners.length - 1];
                activePartners.pop();
                break;
            }
        }
        
        emit PartnerRemoved(partner);
    }
    
    /**
     * @dev Updates platform settings
     */
    function updateSettings(
        uint256 _minimumSavingsPeriod,
        uint256 _minimumMonthlyDeposit,
        uint256 _loanEligibilityThreshold
    ) external onlyOwner {
        minimumSavingsPeriod = _minimumSavingsPeriod;
        minimumMonthlyDeposit = _minimumMonthlyDeposit;
        loanEligibilityThreshold = _loanEligibilityThreshold;
    }
    
    /**
     * @dev Gets account details for a user
     */
    function getAccountDetails(address user) external view returns (
        uint256 balance,
        uint256 matchedAmount,
        uint256 savingsStreak,
        uint256 loanEligibility,
        bool isActive
    ) {
        SavingsAccount storage account = savingsAccounts[user];
        return (
            account.balance,
            account.matchedAmount,
            account.savingsStreak,
            account.loanEligibility,
            account.isActive
        );
    }
}