// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment the line to use openzeppelin/ERC721,ERC20
// You can use this dependency directly because it has been installed by TA already
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract EasyToken is ERC20 {
    constructor() ERC20("EasyBet Token", "EBT") {
        _mint(msg.sender, 1000000 * 10 ** decimals()); // 初始发行100万代币
    }

    function faucet() external {
        _mint(msg.sender, 100 * 10 ** decimals()); // 每次领取100代币
    }
}

contract EasyBet is ERC721("EasyBet", "EBT") {
    EasyToken public easyToken;

    event GambleCreated(uint256 gambleId, string[] choices, address owner);
    event BetPlaced(uint256 betId, uint256 price, address owner);
    event BetListed(uint256 betId, uint256 price, address owner);
    event BetSold(uint256 betId, uint256 price, address buyer);
    event BetListingCancelled(uint256 betId, address owner);
    event GambleResultDeclared(uint256 gambleId, uint256 winningChoice);
    event GambleFinished(uint256 gambleId);
    event PrizeClaimed(uint256 betId, uint256 prizeAmount, address claimer);

    struct Gamble {
        address owner;
        uint256 listedTimestamp;
        uint256 deadline;
        uint256 totalPrize;
        string[] choices;
        uint256[] betIds;
        uint256 winningChoice;
        bool finished;
    }

    struct Bet{
        address owner;
        uint256 listedTimestamp;
        uint256 gambleId;
        uint256 betAmount;
        uint256 betChoice;
        bool isListed;
    }

    struct Betlisting {
        uint256 tokenId;
        uint256 listedTimestamp;
        uint256 price;
        address owner;
    }

    // 订单簿：按价格组织的销售订单
    mapping(uint256 => mapping(uint256 => Betlisting[])) public orderBook; // gambleId => price => listings
    mapping(uint256 => uint256[]) public priceLevels; // gambleId => prices 按价格排序的价格级别
    mapping(uint256 => mapping(uint256 => bool)) public priceLevelExists; // gambleId => price => exists

    mapping(uint256 => Gamble) public gambles;
    mapping (uint256 => Bet) public bets;
    mapping (uint256 => Betlisting) public betListings;

    uint256 public gambleCount;
    uint256 public betCount;

    function getGambleChoices(uint256 gambleId) external view returns (string[] memory) {
        return gambles[gambleId].choices;
    }

    function getGambleBetIds(uint256 gambleId) external view returns (uint256[] memory) {
        return gambles[gambleId].betIds;
    }

    function initialize(address _easyTokenAddress) external {
        easyToken = EasyToken(_easyTokenAddress);
    }


    function createAGamble(string[] memory choices, uint256 totalPrize, uint256 deadline) external {
        require(choices.length >= 2, "At least two choices required");
        require(totalPrize > 0, "Total prize must be greater than zero");   
        require(deadline > block.timestamp, "Deadline must be in the future");

        // 要求创建者预先批准并转移奖金到合约
        bool success = easyToken.transferFrom(msg.sender, address(this), totalPrize);
        require(success, "Failed to transfer prize funds");

        gambles[gambleCount] = Gamble({
            owner: msg.sender,
            listedTimestamp: block.timestamp,
            deadline: deadline,
            totalPrize: totalPrize,
            choices: choices,
            betIds: new uint256[](0),
            winningChoice: type(uint256).max,
            finished: false
        });

        emit GambleCreated(gambleCount, choices, msg.sender);

        gambleCount++;
    }

    function placeABet(uint256 gambleId, uint256 price, uint256 choice) external {
        Gamble storage gamble = gambles[gambleId];
        require(gamble.owner != address(0), "Gamble does not exist");
        require(!gamble.finished, "Gamble has already finished");
        require(block.timestamp < gamble.deadline, "Gamble is over");
        require(choice < gamble.choices.length, "Invalid choice");
        require(price > 0, "Bet price must be greater than zero");
        
        // 转账代币
        bool success = easyToken.transferFrom(msg.sender, address(this), price);
        require(success, "Transfer failed: insufficient allowance or balance");
        
        // 铸造NFT
        uint256 tokenId = betCount;
        _safeMint(msg.sender, tokenId);

        // 创建下注记录
        bets[betCount] = Bet({
            owner: msg.sender,
            listedTimestamp: block.timestamp,
            gambleId: gambleId,
            betAmount: price,
            betChoice: choice,
            isListed: false
        });

        gamble.betIds.push(betCount);
        emit BetPlaced(betCount, price, msg.sender);
        betCount++;
    }


    function declareAGambleResult(uint256 gambleId, uint256 choice) external {
        Gamble storage gamble = gambles[gambleId];
        require(gamble.owner == msg.sender, "Only the owner can declare a result");
        require(choice < gamble.choices.length, "Invalid choice");
        require(!gamble.finished, "Gamble has already finished");
        gamble.winningChoice = choice;
        emit GambleResultDeclared(gambleId, choice);
    }

    function finishAGamble(uint256 gambleId) external {
        Gamble storage gamble = gambles[gambleId];
        require(gamble.owner == msg.sender, "Only the owner can finish the gamble");
        require(gamble.winningChoice != type(uint256).max, "Winning choice not declared");
        require(!gamble.finished, "Gamble is finished");
        
        gamble.finished = true;

        uint256 winnersCount = 0;
        for (uint256 i = 0; i < gamble.betIds.length; i++) {
            uint256 betId = gamble.betIds[i];
            Bet storage currentBet = bets[betId];
            if (currentBet.betChoice == gamble.winningChoice) {
                winnersCount++;
            }
        }

        if (winnersCount > 0) {
            uint256 prizePerWinner = gamble.totalPrize / winnersCount;

            for (uint256 i = 0; i < gamble.betIds.length; i++) {
                uint256 betId = gamble.betIds[i];
                Bet storage currentBet = bets[betId];

                if (currentBet.betChoice == gamble.winningChoice) {
                    // 添加调试信息
                    console.log("Transferring prize for betId: %d", betId);
                    console.log("Bet owner: %s", currentBet.owner);
                    console.log("Prize amount: %d", prizePerWinner);
                    
                    // 确保所有者地址有效
                    require(currentBet.owner != address(0), "Invalid bet owner");
                    
                    easyToken.transfer(currentBet.owner, prizePerWinner);
                    emit PrizeClaimed(betId, prizePerWinner, currentBet.owner);
                }
            }
        }
        else {
            // If no winners, the owner reclaims the total prize
            easyToken.transfer(gamble.owner, gamble.totalPrize);
        }
        
        emit GambleFinished(gambleId);
    }

    function listABet(uint256 betId, uint256 price) external {
        require(ownerOf(betId) != address(0), "Token does not exist");
        require(ownerOf(betId) == msg.sender, "Only the owner can list the bet");
        require(price > 0, "Price must be greater than zero");

        Bet storage bet = bets[betId];
        uint256 gambleId = bet.gambleId;

        betListings[betId] = Betlisting({
            tokenId: betId,
            listedTimestamp: block.timestamp,
            price: price,
            owner: msg.sender
        });

        bets[betId].isListed = true;

        orderBook[gambleId][price].push(betListings[betId]);

        if (!priceLevelExists[gambleId][price]) {
            priceLevels[gambleId].push(price);
            priceLevelExists[gambleId][price] = true;
        }

        emit BetListed(betId, price, msg.sender);
    }

    function buyABet(uint256 tokenId) external {
        Betlisting storage listing = betListings[tokenId];
        require(listing.owner != address(0), "Bet is not listed for sale");
        
        address seller = listing.owner;
        uint256 price = listing.price;

        // Transfer the payment to the seller
        easyToken.transferFrom(msg.sender, seller, price);

        // Transfer the bet NFT to the buyer
        _transfer(listing.owner, msg.sender, tokenId);

        bets[tokenId].owner = msg.sender;
        bets[tokenId].isListed = false;

        // Remove the listing
        removeListingFromOrderBook(bets[tokenId].gambleId, price, tokenId);
        delete betListings[tokenId];

        emit BetSold(tokenId, price, msg.sender);
    }

    function insertSortedPriceLevel(uint256 gambleId, uint256 price) internal {
        uint256[] storage prices = priceLevels[gambleId];

        uint256 insertIndex = prices.length;
        for (uint256 i = 0; i < prices.length; i++) {
            if (price < prices[i]) {
                insertIndex = i;
                break;
            }
        }

        prices.push();
        for (uint256 i = prices.length - 1; i > insertIndex; i--) {
            prices[i] = prices[i - 1];
        }
        prices[insertIndex] = price;
    }

    function removeListingFromOrderBook(uint256 gambleId, uint256 price, uint256 tokenId) internal {
        Betlisting[] storage listings = orderBook[gambleId][price];

        uint256 indexToRemove = type(uint256).max;
        for (uint256 i = 0; i < listings.length; i++) {
            if (listings[i].tokenId == tokenId) {
                indexToRemove = i;
                break;
            }
        }
        
        if (indexToRemove != type(uint256).max) {
            if (indexToRemove != listings.length - 1) {
                listings[indexToRemove] = listings[listings.length - 1];
            }
            listings.pop();
            
            if (listings.length == 0) {
                priceLevelExists[gambleId][price] = false;
                removePriceLevel(gambleId, price);
            }
        }
    }

    function removePriceLevel(uint256 gambleId, uint256 price) internal {
        uint256[] storage prices = priceLevels[gambleId];

        uint256 indexToRemove = type(uint256).max;
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i] == price) {
                indexToRemove = i;
                break;
            }
        }

        if (indexToRemove != type(uint256).max) {
            if (indexToRemove != prices.length - 1) {
                prices[indexToRemove] = prices[prices.length - 1];
            }
            prices.pop();
        }
    }

    function getOrderBookForGamble(uint256 gambleId) external view returns (
        uint256[] memory prices,
        uint256[] memory choiceIds,
        uint256[] memory betIds
    ) {
        Gamble storage gamble = gambles[gambleId];
        uint256 choicesCount = gamble.choices.length;
        
        // 计算总的订单数量
        uint256 totalListings = 0;
        for (uint256 i = 0; i < priceLevels[gambleId].length; i++) {
            uint256 price = priceLevels[gambleId][i];
            totalListings += orderBook[gambleId][price].length;
        }
        
        // 初始化返回数组
        prices = new uint256[](totalListings);
        choiceIds = new uint256[](totalListings);
        betIds = new uint256[](totalListings);
        
        uint256 index = 0;
        // 遍历所有价格级别
        for (uint256 i = 0; i < priceLevels[gambleId].length; i++) {
            uint256 price = priceLevels[gambleId][i];
            Betlisting[] storage listings = orderBook[gambleId][price];
            
            // 按选项分组统计数量
            for (uint256 choice = 0; choice < choicesCount; choice++) {
                for (uint256 j = 0; j < listings.length; j++) {
                    uint256 tokenId = listings[j].tokenId;
                    if (bets[tokenId].betChoice == choice) {
                        prices[index] = price;
                        choiceIds[index] = choice;
                        betIds[index] = tokenId; // 添加betId
                        index++;
                    }
                }
            }
        }
        
        // 调整数组大小以匹配实际数量
        if (index < totalListings) {
            assembly {
                mstore(prices, index)
                mstore(choiceIds, index)
                mstore(betIds, index)
            }
        }
    }

    function cancelABetListing(uint256 tokenId) external { 
        Betlisting storage listing = betListings[tokenId];

        require(listing.owner != address(0), "Bet is not listed for sale");
        require(listing.owner == msg.sender, "Only the owner can cancel the listing");
        
        bets[tokenId].isListed = false;
        delete betListings[tokenId];

        emit BetListingCancelled(tokenId, msg.sender);
    
    }

}