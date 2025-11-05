# EasyBet - 去中心化彩票竞猜系统
## 项目简介

本项目是一个进阶的去中心化彩票系统，允许用户创建竞猜项目、购买彩票并进行彩票交易。系统基于以太坊区块链技术，使用Solidity智能合约实现核心功能，前端使用React框架构建用户界面。

与传统彩票系统不同，本系统允许玩家在结果公布前交易其持有的彩票NFT，以应对项目进行期间的突发状况，提高彩票游戏的可玩性和灵活性。

彩票总奖金固定，不随投注变化，每个选择正确选项的彩票为一个奖金分配单元，结算时总奖金按分配单元数进行平分，拥有多张中奖彩票的玩家会获得多个单元的奖金

## 功能实现分析

### 核心功能

#### 1. 创建竞猜项目
```solidity
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
```
1. 参数验证：
- 至少需要2个选项
- 奖金必须大于0
- 截止时间必须在未来
2. 资金处理：
- 使用 transferFrom 要求创建者预先授权合约操作代币
- 奖金从创建者账户转入合约账户
3. 数据存储：
- 创建 Gamble 结构体存储项目信息
- 初始化空的 betIds 数组用于跟踪后续下注
- 设置 winningChoice 为最大值表示未公布结果

#### 2. 购买彩票
```solidity
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
```
1. 验证检查：

- 确认赌局存在且未结束
- 确认在截止时间前
- 验证选择选项有效
- 确认下注金额大于0
2. 资金转移：

- 从玩家账户转移代币到合约账户
- 需要玩家预先授权合约操作代币
3. NFT铸造：

- 继承自ERC721，使用 _safeMint 为玩家铸造彩票NFT
- Token ID为递增的 betCount
4. 记录关联：

- 在赌局的 betIds 数组中添加新下注ID
- 创建 Bet 结构体记录详细信息
#### 3. 彩票交易
```solidity
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

    bets[tokenId].isListed = false;
    bets[tokenId].owner = msg.sender;

    // Remove the listing
    removeListingFromOrderBook(bets[tokenId].gambleId, price, tokenId);
    delete betListings[tokenId];

    emit BetSold(tokenId, price, msg.sender);
}

// 订单簿：按价格组织的销售订单
mapping(uint256 => mapping(uint256 => Betlisting[])) public orderBook; // gambleId => price => listings
mapping(uint256 => uint256[]) public priceLevels; // gambleId => prices 按价格排序的价格级别
mapping(uint256 => mapping(uint256 => bool)) public priceLevelExists; // gambleId => price => exists
```
1. 挂单流程：

- 验证NFT所有权
- 创建 Betlisting 记录挂单信息
- 添加到订单簿的对应价格级别
- 维护价格级别列表
2. 购买流程：

- 验证挂单存在
- 从买家转移资金给卖家
- 转移NFT所有权
- 从订单簿移除挂单记录
3. 订单簿结构：

- 三层映射：赌局ID → 价格 → 挂单列表
- 维护价格级别列表用于前端展示


#### 4. 竞猜结算
```solidity
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
```
1. 两阶段结算：

- 公布结果：公证人指定获胜选项
- 结束竞猜：分配奖金并标记完成
2. 奖金分配：

- 统计获胜选项的下注数量
- 平均分配奖金池给获胜者
- 无获胜者时奖金返还创建者
3. 安全检查：

- 仅允许创建者操作
- 确保结果已公布
- 防止重复结算

### Bonus功能实现

#### 1. ERC20代币系统
```solidity
contract EasyToken is ERC20 {
    constructor() ERC20("EasyBet Token", "EBT") {
        _mint(msg.sender, 1000000 * 10 ** decimals()); // 初始发行100万代币
    }

    function faucet() external {
        _mint(msg.sender, 100 * 10 ** decimals()); // 每次领取100代币
    }
}
```
1. 初始分配：

- 继承OpenZeppelin ERC20标准实现
- 实现了名为"EasyBet Token"(EBT)的ERC20代币
- 所有交易和结算均使用该代币完成
- 创建时向部署者铸造100万代币
2. 水龙头功能：

- 任何人都可调用 faucet() 函数获取100代币
- 使用 _mint 直接创建新代币

#### 2. 链上订单簿
```solidity
// 订单簿：按价格组织的销售订单
mapping(uint256 => mapping(uint256 => Betlisting[])) public orderBook; // gambleId => price => listings
mapping(uint256 => uint256[]) public priceLevels; // gambleId => prices 按价格排序的价格级别
mapping(uint256 => mapping(uint256 => bool)) public priceLevelExists; // gambleId => price => exists

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
```
1. 多层次映射结构：

- 按赌局ID分组
- 按价格级别组织
- 每个价格级别包含多个挂单
2. 价格级别维护：

- priceLevels 存储排序的价格列表
- priceLevelExists 跟踪价格级别存在性
3. 前端友好查询：

- 提供专门的查询函数返回结构化数据
- 按选项分组返回订单信息
- 支持前端按价格排序显示

## 如何运行

### 环境准备

1. 安装Node.js (建议版本16.x或以上)
2. 安装Ganache-cli作为本地以太坊测试网络
3. 安装MetaMask浏览器扩展（开发时使用edge浏览器）

### 运行步骤

1. 在本地启动Ganache应用，确保RPC服务运行在`http://127.0.0.1:2853`，使用助记词`myth like bonus scare over problem client lizard pioneer submit female collect`保持账户地址一致，便于开发和测试
```bash
npx ganache-cli -p 2853 -m "myth like bonus scare over problem client lizard pioneer submit female collect" --gasLimit 0x1fffffffffffff --gasPrice 0x1 --allowUnlimitedContractSize --noVMErrorsOnRPCResponse
```

2. 在 `./contracts` 目录中安装需要的依赖，运行如下命令：
```bash
npm install
```

3. 在 `./contracts` 目录中编译合约，运行如下命令：
```bash
npx hardhat compile
```

4. 部署智能合约到Ganache网络：部署脚本会自动更新前端代码`./front/src/contract_utils.ts`中的地址配置，并复制abi文件到前端代码中
```bash
npx hardhat run scripts/deploy.ts --network ganache
```

6. 在 `./frontend` 目录中安装需要的依赖，运行如下命令：
```bash
npm install
```

7. 在 `./frontend` 目录中启动前端程序，运行如下命令：自动启动浏览器并打开`http://localhost:3000`
```bash
npm run start
```

8. 在浏览器扩展MetaMask中连接到Ganache网络，并导入数个Ganache账户用于测试
   - 添加自定义网络 网络名称自选，默认 RPC（远程过程调用）URL 为`127.0.0.1:2853`，链ID`1337`
   - 添加账户 通过私钥导入，粘贴`hardhat.config.ts`文件中`accounts`的私钥
   - `accounts`中第一个账户为项目创建者，拥有铸造发行的1000000EBT，其余账户初始不拥有EBT，可以通过水龙头功能获得，可以将第一个账户作为公证人，任意其他账户也可以在领取EBT后作为公证人，创建赌局
   - 在接下来的测试流程中，除去项目创建者的账户，还需要5个账户作为测试用户添加到MetaMask中

## 项目运行截图

以下是本项目关键界面和使用流程的说明：

### 关键界面
#### 一、顶部信息栏
![项目主界面1](assets/main1.png)
- Account：显示当前连接的区块链钱包地址（如截图中的0x22d4...e32b）。它是用户在 DApp 中操作的 “身份标识”，所有链上交易（创建赌局、下注、领奖金等）均由该地址发起并签名
- Balance：展示账户持有的EBT 代币余额（当前为0.0 EBT）。EBT 是该 DApp 的自定义代币，用于赌局奖金池、下注支付、Gas 费覆盖等场景
- Faucet（领取 100 EBT）：测试环境专属的 “代币水龙头” 功能。点击可免费获取 100 个 EBT，解决测试阶段的资金需求
#### 二、“创建新的 Gamble” 表单区域
![项目主界面1](assets/main1.png)
这是用户创建赌局的核心操作模块，需完成以下信息填写：
- 选项列表：定义赌局的可投注结果，可通过 “添加选项” 按钮新增、“删除” 按钮移除
- 总奖金：输入赌局的奖金池总额。从区块链逻辑看，创建者需预先将该金额的 EBT 转入合约，通过钱包授权合约操作代币，确保奖金池资金充足
- 截止时间：设置赌局的 “下注截止节点”。超过该时间后用户无法再下注，公证人可启动 “公布结果” 流程，保证赌局的时间边界清晰且不可篡改
- 创建 Gamble 按钮：填写完所有必填项后，点击将发起区块链交易。该交易将赌局信息上链，同时触发 “奖金转入合约” 的流程，最终在链上生成一个透明、不可篡改的赌局实例
#### 三、Gamble 列表
![项目主界面2](assets/main2.png)
显示当前已创建的赌局列表，包括名称、截止时间、奖金、选项等信息
- 展示存在过的所有赌局，包括进行中的与已结束的
- 点击详情，显示该赌局详细信息
#### 四、Gamble 详情
##### 赌局基本信息区
![项目主界面3](assets/main3.png)
- Gamble #0：标识这是系统中第 0 个创建的赌局
- 奖金: 10.0 EBT：该赌局的奖金池总额，由创建者预先转入合约，最终将由获胜者按规则瓜分
- 截止: 2025/11/5 00:44:00：下注的时间截止点，超过该时间用户无法再下注与买卖挂单
- 状态：进行中：当前赌局阶段，用户可执行下注、挂单等操作
##### 选项详情与下注操作区
![项目主界面3](assets/main3.png)
- 选项详情：列出赌局的可投注结果（RED、BLUE、GREEN）
- 下注操作：
    - 金额 (EBT)：输入下注的 EBT 代币数量，需确保账户余额充足且已授权合约操作代币
    选择：下拉选择要下注的选项
    - 下注按钮：点击后发起区块链交易，将 EBT 转入赌局合约并记录下注选项，操作需钱包签名确认

##### Bets 列表
![项目主界面4](assets/main4.png)
- Bet ID 0：标识这是该赌局中第 0 个创建的下注
- 所有者（钱包地址）：显示下注者的区块链钱包地址，明确下注的归属权
- 下注选项与金额：记录下注时选择的赌局选项和投入的 EBT 代币金额
- 未挂单：可通过输入价格并点击 “挂单” 按钮，将下注凭证发布到订单簿中，供其他用户购买
- 已挂单：状态显示 “已挂单”，该下注凭证会显示在订单簿中

##### 订单簿区
![项目主界面5](assets/main5.png)
- Bet ID：下注凭证的唯一链上标识，用于精准定位该笔下注。
- 所有者：下注凭证当前持有者的钱包地址，明确资产归属。
- 下注选项：该凭证对应的赌局选项，购买后将持有该选项的下注权益
- 挂单价格：购买该凭证需支付的 EBT 代币数量
- 购买按钮：点击后发起区块链交易，完成 “支付 EBT→获取下注凭证” 的流程，交易需钱包签名确认

##### 管理员操作区
![项目主界面6](assets/main6.png)
- 获胜选项：下拉选择最终获胜的选项，由公证人即赌局发起者根据实际结果填写。
- 公布结果：点击后触发链上交易，合约根据获胜选项分配奖金给对应的下注者，仅管理员可执行
- 结束竞猜：点击后关闭赌局，禁止后续任何下注、挂单操作

### 测试流程

#### 1. 创建赌局
##### 1.1 公证人领取初始代币
连接 MetaMask 到第一个账户（公证人账户）
在前端界面点击 "Faucet（领取 100 EBT）" 按钮
![测试1](assets/test1.png)
确认 MetaMask 交易，账户应显示 100 EBT 余额
![测试2](assets/test2.png) 
再次领取，获取 200 EBT
##### 1.2 创建新的赌局
在 "创建新的 Gamble" 区域填写信息：
![测试3](assets/test3.png) 
选项列表：添加选项 "RED"、"BLUE"、"GREEN"
总奖金：输入 100（表示奖池为 100 EBT）
截止时间：设置为未来某个时间点（如1小时后）
点击 "创建 Gamble" 按钮

MetaMask 会弹出两次确认：
第一次：授权合约操作指定数量的 EBT 代币
![测试4](assets/test4.png) 
第二次：确认创建赌局的交易
![测试5](assets/test5.png) 
确认交易后，点击刷新，赌局列表中会出现新创建的赌局
![测试6](assets/test6.png) 
#### 2. 玩家下注
##### 2.1 玩家领取测试代币
切换 MetaMask 到第二个账户（玩家1）
点击 "Faucet（领取 100 EBT）" 按钮
确认交易，账户应显示 100 EBT 余额
##### 2.2 玩家进行下注
在赌局列表中找到刚创建的赌局，点击“详情”查看详细信息
在下注区域：
![测试7](assets/test7.png) 
输入下注金额（如 10 EBT）
选择下注选项（如 "RED"）
点击 "下注" 继续
MetaMask 会弹出两次确认：
第一次：授权合约操作指定数量的 EBT 代币
![测试8](assets/test8.png) 
第二次：确认下注交易
![测试9](assets/test9.png) 
确认后，需要收起详情并重新展开，此时 Bets 列表中会出现新的下注记录
如果未出现，请刷新页面
![测试10](assets/test10.png) 
##### 2.3 其他玩家下注
重复 2.1-2.2 步骤，使用不同账户对不同选项进行下注：
![测试11](assets/test11.png) 
玩家2：下注 15 EBT 到 "BLUE" 选项
玩家3：下注 20 EBT 到 "RED" 选项
玩家4：下注 12 EBT 到 "GREEN" 选项
#### 3. 挂单和购买
##### 3.1 玩家挂单出售彩票
MetaMask切换账户到玩家1 
在 "未挂单" 状态下，输入挂单价格（如 15 EBT）
![测试12](assets/test12.png) 
点击 "挂单" 按钮
确认 MetaMask 交易
![测试13](assets/test13.png) 
下注状态变为 "已挂单"，在订单簿中点击刷新按钮显示
![测试14](assets/test14.png) 
![测试15](assets/test15.png) 
##### 3.2 其他玩家购买挂单
切换账户到玩家2，在订单簿区域找到玩家1的挂单
点击 "购买" 按钮
MetaMask 弹出确认：
授权合约操作 15 EBT 代币
![测试16](assets/test16.png) 
确认购买交易
![测试17](assets/test17.png) 
确认后，订单簿中该挂单消失，玩家2 成为该彩票的新所有者（所有者地址发生变更）
![测试18](assets/test18.png) 
![测试19](assets/test19.png) 
##### 3.3 更多挂单和购买操作
玩家3 将自己的下注以 18 EBT 挂单
玩家4 购买玩家3的挂单
![测试20](assets/test20.png) 
此时 bets 列表中只剩玩家1和玩家4的 bet
#### 4. 赌局结束和结算
##### 4.1 公证人公布结果
切换回公证人账户
在管理员操作区域：
从下拉菜单选择获胜选项（假设 "RED" 为获胜选项）
点击 "公布结果" 按钮
确认 MetaMask 交易
![测试21](assets/test21.png) 
点击 "结束竞猜" 按钮
确认 MetaMask 交易
![测试22](assets/test22.png) 
gamble 列表中该赌局状态变为 "已结束"，管理员操作区域消失
![测试23](assets/test23.png) 
##### 4.2 系统自动结算
合约会将赌局奖金平分给所有选择获胜选项的 bet 的所有者
在经过 bet 挂单买卖后，存在两个选择了获胜选项的 bet，所有者为玩家2与玩家4共两名玩家，赌局奖金100 EBT被平分为 50 EBT 发送给玩家2和玩家4
##### 4.3 玩家领取奖金
获胜玩家（玩家2 和玩家4）可以在各自的账户页面查看更新后的余额
他们应该看到 EBT 余额增加了相应的奖金份额
##### 4.4 验证结算结果
检查各玩家的最终余额：
公证人：初始200 - 100（奖池）= 100 EBT
![测试24](assets/test24.png) 
玩家1：初始100 - 10（下注）+ 15（转让彩票所得）= 105 EBT
![测试25](assets/test25.png) 
玩家2：初始100 - 15（下注）- 15（购买彩票）+ 50（获胜奖金份额）= 120 EBT
![测试26](assets/test26.png) 
玩家3：初始100 - 20（下注）+ 18（转让彩票所得）= 98 EBT
![测试27](assets/test27.png) 
玩家4：初始100 - 12（下注）- 18（购买彩票）+ 50（获胜奖金份额）= 120 EBT
![测试28](assets/test28.png) 


## 参考内容

- 课程的参考Demo见：[DEMOs](https://github.com/LBruyne/blockchain-course-demos)。

- 快速实现 ERC721 和 ERC20：[模版](https://wizard.openzeppelin.com/#erc20)。记得安装相关依赖 ``"@openzeppelin/contracts": "^5.0.0"``。

- 如何实现ETH和ERC20的兑换？ [参考讲解](https://www.wtf.academy/en/docs/solidity-103/DEX/)

- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
