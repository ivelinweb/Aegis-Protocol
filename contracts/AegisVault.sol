// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AegisVault
 * @author Aegis Protocol
 * @notice Non-custodial vault that allows users to deposit ETH/tokens and
 *         authorize AI agents to execute protective actions on their behalf.
 *         Users retain full control — agents can only protect, never steal.
 * @dev Implements deposit/withdraw, agent authorization, position tracking,
 *      and emergency withdrawal mechanisms.
 */
contract AegisVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    //                        STRUCTS
    // ═══════════════════════════════════════════════════════════════

    /// @notice User position in the vault
    struct Position {
        uint256 ethBalance;          // ETH deposited
        uint256 depositTimestamp;     // When first deposited
        uint256 lastActionTimestamp;  // Last agent action timestamp
        bool isActive;               // Whether position is active
        uint256 authorizedAgentId;   // Authorized agent token ID
        bool agentAuthorized;        // Whether an agent is authorized
        RiskProfile riskProfile;     // User's risk tolerance
    }

    /// @notice Token balance tracking
    struct TokenBalance {
        address token;
        uint256 amount;
    }

    /// @notice User-defined risk tolerance
    struct RiskProfile {
        uint256 maxSlippage;           // Max slippage in basis points (e.g., 100 = 1%)
        uint256 stopLossThreshold;     // Auto-exit if loss exceeds this (basis points)
        uint256 maxSingleActionValue;  // Max value per agent action (wei)
        bool allowAutoWithdraw;        // Allow agent to auto-withdraw on threats
        bool allowAutoSwap;            // Allow agent to swap tokens for protection
    }

    /// @notice Protection action executed by an agent
    struct ProtectionAction {
        uint256 agentId;
        address user;
        ActionType actionType;
        uint256 value;
        uint256 timestamp;
        bytes32 reasonHash;      // IPFS hash of AI reasoning
        bool successful;
    }

    /// @notice Types of protection actions
    enum ActionType {
        EmergencyWithdraw,    // Withdraw funds to safety
        Rebalance,            // Rebalance position
        AlertOnly,            // Alert user (no fund movement)
        StopLoss,             // Execute stop-loss
        TakeProfit            // Execute take-profit
    }

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    /// @notice User positions
    mapping(address => Position) public positions;

    /// @notice User ERC20 token balances: user => token => amount
    mapping(address => mapping(address => uint256)) public tokenBalances;

    /// @notice User's deposited tokens list
    mapping(address => address[]) public userTokens;

    /// @notice All protection actions history
    ProtectionAction[] public actionHistory;

    /// @notice Actions by user
    mapping(address => uint256[]) public userActions;

    /// @notice Actions by agent
    mapping(uint256 => uint256[]) public agentActions;

    /// @notice Reference to the agent registry contract
    address public registryAddress;

    /// @notice Total ETH deposited across all users
    uint256 public totalEthDeposited;

    /// @notice Total protection actions executed
    uint256 public totalActionsExecuted;

    /// @notice Total value protected across all actions
    uint256 public totalValueProtected;

    /// @notice Protocol fee in basis points (e.g., 50 = 0.5%)
    uint256 public protocolFeeBps;

    /// @notice Minimum deposit amount
    uint256 public minDeposit;

    /// @notice Whether the vault is paused for new deposits
    bool public depositsPaused;

    /// @notice Authorized agent operators (operator address => authorized)
    mapping(address => bool) public authorizedOperators;

    // ═══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════════

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event ETHDeposited(address indexed user, uint256 amount);
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp);
    event TokenWithdrawn(address indexed user, address indexed token, uint256 amount);
    event AgentAuthorized(address indexed user, uint256 indexed agentId);
    event AgentRevoked(address indexed user, uint256 indexed agentId);
    event RiskProfileUpdated(address indexed user);
    event ProtectionExecuted(
        uint256 indexed actionId,
        uint256 indexed agentId,
        address indexed user,
        ActionType actionType,
        uint256 value,
        bytes32 reasonHash,
        bool successful
    );
    event EmergencyWithdrawal(address indexed user, uint256 ethAmount);

    // ═══════════════════════════════════════════════════════════════
    //                      MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyAuthorizedAgent(address user) {
        require(positions[user].agentAuthorized, "No agent authorized");
        require(authorizedOperators[msg.sender], "Not authorized operator");
        _;
    }

    modifier whenDepositsActive() {
        require(!depositsPaused, "Deposits paused");
        _;
    }

    modifier hasPosition() {
        require(positions[msg.sender].isActive, "No active position");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //                    CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(
        address _registryAddress,
        uint256 _protocolFeeBps,
        uint256 _minDeposit
    ) Ownable(msg.sender) {
        require(_registryAddress != address(0), "Invalid registry");
        require(_protocolFeeBps <= 500, "Fee too high"); // Max 5%

        registryAddress = _registryAddress;
        protocolFeeBps = _protocolFeeBps;
        minDeposit = _minDeposit;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   USER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Deposit ETH into the vault
     */
    function deposit() external payable nonReentrant whenDepositsActive {
        require(msg.value >= minDeposit, "Below minimum deposit");

        Position storage pos = positions[msg.sender];

        if (!pos.isActive) {
            pos.depositTimestamp = block.timestamp;
            pos.isActive = true;
            // Set default risk profile
            pos.riskProfile = RiskProfile({
                maxSlippage: 100,           // 1%
                stopLossThreshold: 1000,    // 10%
                maxSingleActionValue: msg.value / 2, // 50% of deposit
                allowAutoWithdraw: true,
                allowAutoSwap: false
            });
        }

        pos.ethBalance += msg.value;
        totalEthDeposited += msg.value;

        emit Deposited(msg.sender, msg.value, block.timestamp);
        emit ETHDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Deposit ERC20 tokens into the vault
     * @param token Token contract address
     * @param amount Amount to deposit
     */
    function depositToken(address token, uint256 amount) external nonReentrant whenDepositsActive {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        Position storage pos = positions[msg.sender];
        if (!pos.isActive) {
            pos.depositTimestamp = block.timestamp;
            pos.isActive = true;
            pos.riskProfile = RiskProfile({
                maxSlippage: 100,
                stopLossThreshold: 1000,
                maxSingleActionValue: type(uint256).max,
                allowAutoWithdraw: true,
                allowAutoSwap: false
            });
        }

        if (tokenBalances[msg.sender][token] == 0) {
            userTokens[msg.sender].push(token);
        }
        tokenBalances[msg.sender][token] += amount;

        emit TokenDeposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw ETH from the vault
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdraw(uint256 amount) external nonReentrant hasPosition {
        Position storage pos = positions[msg.sender];
        uint256 withdrawAmount = amount == 0 ? pos.ethBalance : amount;

        require(withdrawAmount <= pos.ethBalance, "Insufficient balance");

        pos.ethBalance -= withdrawAmount;
        totalEthDeposited -= withdrawAmount;

        if (pos.ethBalance == 0 && _getUserTokenCount(msg.sender) == 0) {
            pos.isActive = false;
        }

        (bool sent, ) = payable(msg.sender).call{value: withdrawAmount}("");
        require(sent, "Transfer failed");

        emit Withdrawn(msg.sender, withdrawAmount, block.timestamp);
    }

    /**
     * @notice Withdraw ERC20 tokens from the vault
     * @param token Token address
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdrawToken(address token, uint256 amount) external nonReentrant hasPosition {
        uint256 balance = tokenBalances[msg.sender][token];
        uint256 withdrawAmount = amount == 0 ? balance : amount;

        require(withdrawAmount <= balance, "Insufficient token balance");

        tokenBalances[msg.sender][token] -= withdrawAmount;
        IERC20(token).safeTransfer(msg.sender, withdrawAmount);

        emit TokenWithdrawn(msg.sender, token, withdrawAmount);
    }

    /**
     * @notice Authorize an AI agent to protect your position
     * @param agentId Agent token ID from the registry
     */
    function authorizeAgent(uint256 agentId) external hasPosition {
        Position storage pos = positions[msg.sender];
        pos.authorizedAgentId = agentId;
        pos.agentAuthorized = true;

        emit AgentAuthorized(msg.sender, agentId);
    }

    /**
     * @notice Revoke agent authorization
     */
    function revokeAgent() external hasPosition {
        Position storage pos = positions[msg.sender];
        uint256 oldAgentId = pos.authorizedAgentId;
        pos.agentAuthorized = false;
        pos.authorizedAgentId = 0;

        emit AgentRevoked(msg.sender, oldAgentId);
    }

    /**
     * @notice Update risk profile settings
     * @param maxSlippage Max slippage in basis points
     * @param stopLossThreshold Stop loss threshold in basis points
     * @param maxSingleActionValue Max value per agent action
     * @param allowAutoWithdraw Allow agent to auto-withdraw
     * @param allowAutoSwap Allow agent to swap tokens
     */
    function updateRiskProfile(
        uint256 maxSlippage,
        uint256 stopLossThreshold,
        uint256 maxSingleActionValue,
        bool allowAutoWithdraw,
        bool allowAutoSwap
    ) external hasPosition {
        require(maxSlippage <= 1000, "Slippage too high"); // Max 10%
        require(stopLossThreshold <= 5000, "Stop loss too high"); // Max 50%

        positions[msg.sender].riskProfile = RiskProfile({
            maxSlippage: maxSlippage,
            stopLossThreshold: stopLossThreshold,
            maxSingleActionValue: maxSingleActionValue,
            allowAutoWithdraw: allowAutoWithdraw,
            allowAutoSwap: allowAutoSwap
        });

        emit RiskProfileUpdated(msg.sender);
    }

    /**
     * @notice Emergency withdraw all funds immediately
     */
    function emergencyWithdraw() external nonReentrant {
        Position storage pos = positions[msg.sender];
        uint256 ethAmount = pos.ethBalance;

        // Reset position
        pos.ethBalance = 0;
        pos.isActive = false;
        pos.agentAuthorized = false;

        totalEthDeposited -= ethAmount;

        // Withdraw all tokens
        address[] storage tokens = userTokens[msg.sender];
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenBal = tokenBalances[msg.sender][tokens[i]];
            if (tokenBal > 0) {
                tokenBalances[msg.sender][tokens[i]] = 0;
                IERC20(tokens[i]).safeTransfer(msg.sender, tokenBal);
            }
        }

        // Withdraw ETH
        if (ethAmount > 0) {
            (bool sent, ) = payable(msg.sender).call{value: ethAmount}("");
            require(sent, "ETH transfer failed");
        }

        emit EmergencyWithdrawal(msg.sender, ethAmount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   AGENT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Execute a protection action on behalf of a user
     * @param user User address to protect
     * @param actionType Type of protective action
     * @param value Value involved in the action
     * @param reasonHash IPFS hash of AI reasoning/analysis
     * @return actionId The action ID in the history
     */
    function executeProtection(
        address user,
        ActionType actionType,
        uint256 value,
        bytes32 reasonHash
    ) external nonReentrant onlyAuthorizedAgent(user) returns (uint256 actionId) {
        Position storage pos = positions[user];
        require(pos.isActive, "Position not active");

        uint256 agentId = pos.authorizedAgentId;

        // Validate action against risk profile
        if (actionType == ActionType.EmergencyWithdraw) {
            require(pos.riskProfile.allowAutoWithdraw, "Auto-withdraw not allowed");
        }

        if (value > 0) {
            require(value <= pos.riskProfile.maxSingleActionValue, "Exceeds max action value");
        }

        bool successful = true;

        // Execute the protection action
        if (actionType == ActionType.EmergencyWithdraw && value > 0) {
            require(value <= pos.ethBalance, "Insufficient ETH");
            pos.ethBalance -= value;
            totalEthDeposited -= value;

            (bool sent, ) = payable(user).call{value: value}("");
            successful = sent;
        } else if (actionType == ActionType.StopLoss && value > 0) {
            require(value <= pos.ethBalance, "Insufficient ETH");
            require(pos.riskProfile.allowAutoWithdraw, "Auto-withdraw not allowed");
            pos.ethBalance -= value;
            totalEthDeposited -= value;

            (bool sent, ) = payable(user).call{value: value}("");
            successful = sent;
        }

        pos.lastActionTimestamp = block.timestamp;

        // Record the action
        actionId = actionHistory.length;
        actionHistory.push(ProtectionAction({
            agentId: agentId,
            user: user,
            actionType: actionType,
            value: value,
            timestamp: block.timestamp,
            reasonHash: reasonHash,
            successful: successful
        }));

        userActions[user].push(actionId);
        agentActions[agentId].push(actionId);

        totalActionsExecuted++;
        if (successful && value > 0) {
            totalValueProtected += value;
        }

        emit ProtectionExecuted(
            actionId,
            agentId,
            user,
            actionType,
            value,
            reasonHash,
            successful
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //                   VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get user's full position info
     */
    function getPosition(address user) external view returns (Position memory) {
        return positions[user];
    }

    /**
     * @notice Get user's deposited ETH balance
     */
    function getUserDepositETH(address user) external view returns (uint256) {
        return positions[user].ethBalance;
    }

    /**
     * @notice Get user's risk profile
     */
    function getRiskProfile(address user) external view returns (RiskProfile memory) {
        return positions[user].riskProfile;
    }

    /**
     * @notice Get user's token balance
     */
    function getTokenBalance(address user, address token) external view returns (uint256) {
        return tokenBalances[user][token];
    }

    /**
     * @notice Get user's deposited token list
     */
    function getUserTokens(address user) external view returns (address[] memory) {
        return userTokens[user];
    }

    /**
     * @notice Get total action history count
     */
    function getActionCount() external view returns (uint256) {
        return actionHistory.length;
    }

    /**
     * @notice Get user's action history IDs
     */
    function getUserActions(address user) external view returns (uint256[] memory) {
        return userActions[user];
    }

    /**
     * @notice Get agent's action history IDs
     */
    function getAgentActions(uint256 agentId) external view returns (uint256[] memory) {
        return agentActions[agentId];
    }

    /**
     * @notice Get a specific protection action
     */
    function getAction(uint256 actionId) external view returns (ProtectionAction memory) {
        require(actionId < actionHistory.length, "Action does not exist");
        return actionHistory[actionId];
    }

    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 _totalEthDeposited,
        uint256 _totalActionsExecuted,
        uint256 _totalValueProtected
    ) {
        return (totalEthDeposited, totalActionsExecuted, totalValueProtected);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Set authorized operator status
     */
    function setOperatorAuthorization(address operator, bool authorized) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        authorizedOperators[operator] = authorized;
    }

    /**
     * @notice Pause/resume deposits
     */
    function setDepositsPaused(bool paused) external onlyOwner {
        depositsPaused = paused;
    }

    /**
     * @notice Update protocol fee
     */
    function setProtocolFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 500, "Fee too high");
        protocolFeeBps = newFeeBps;
    }

    /**
     * @notice Update minimum deposit
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        minDeposit = newMinDeposit;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function _getUserTokenCount(address user) internal view returns (uint256 count) {
        address[] storage tokens = userTokens[user];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokenBalances[user][tokens[i]] > 0) {
                count++;
            }
        }
    }

    receive() external payable {
        // Accept ETH transfers
    }
}
