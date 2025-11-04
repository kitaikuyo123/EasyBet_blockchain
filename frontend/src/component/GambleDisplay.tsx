import React, { useState, useEffect } from 'react';
import { getGamble, placeBet, listBet, buyBet, getGamblesNum, finishGamble, declareWinner, getBetsForGamble } from '../contract_utils';
import { Button, InputField } from "./common";
import OrderBookDisplay from "./OrderbookDisplay"

interface Gamble {
  owner: string;
  deadline: Date;
  totalPrize: string;
  choices: string[];
  winningChoice: string;
  finished: boolean;
}

interface Bet {
  id: number;
  owner: string;
  gambleId: string;
  betAmount: string;
  betChoice: string;
  isListed: boolean;
}

export default function GambleList() {
  const [gambles, setGambles] = useState<{[id: number]: Gamble}>({});
  const [expandedGamble, setExpandedGamble] = useState<number | null>(null);
  const [bets, setBets] = useState<{[key: number]: Bet[]}>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [gambleCount, setGambleCount] = useState<number>(0);

  const fetchGambles = async () => {
    setLoading(true);
    try {
      const maxGambleId = await getGamblesNum();
      const gambleData: {[id: number]: Gamble} = {};
      const betsData: {[id: number]: Bet[]} = {};
      
      for (let id = 0; id < maxGambleId; id++) {
        try {
          const gamble = await getGamble(id);
          if (gamble) {
            gambleData[id] = gamble;
            // 获取该 gamble 的所有 bets
            const gambleBets = await getBetsForGamble(id);
            betsData[id] = gambleBets;
          }
        } catch (error) {
          console.log(`Gamble ${id} 不存在`);
        }
      }
      
      setGambles(gambleData);
      setBets(betsData);
    } catch (error) {
      console.error('获取 gamble 列表失败:', error);
      setMessage('获取 gamble 列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGambles();
  }, []);

  const toggleExpand = async (gambleId: number) => {
    if (expandedGamble === gambleId) {
      setExpandedGamble(null);
    } else {
      setExpandedGamble(gambleId);
      // 当展开 gamble 时，刷新该 gamble 的 bets
      try {
        const gambleBets = await getBetsForGamble(gambleId);
        setBets(prev => ({
          ...prev,
          [gambleId]: gambleBets
        }));
      } catch (error) {
        console.error(`获取 gamble ${gambleId} 的 bets 失败:`, error);
      }
    }
  };

  const handlePlaceBet = async (gambleId: number, amount: string, choice: number) => {
    try {
      const success = await placeBet(gambleId, amount, choice);
      if (success) {
        setMessage('下注成功!');
        // 刷新数据
        fetchGambles();
      } else {
        setMessage('下注失败');
      }
    } catch (error) {
      console.error('下注失败:', error);
      setMessage('下注失败: ' + (error as Error).message);
    }
  };

  const handleListBet = async (betId: number, price: string) => {
    try {
      const success = await listBet(betId, price);
      if (success) {
        setMessage('挂单成功!');
        // 刷新数据
        fetchGambles();
      } else {
        setMessage('挂单失败');
      }
    } catch (error) {
      console.error('挂单失败:', error);
      setMessage('挂单失败: ' + (error as Error).message);
    }
  };

  const handleBuyBet = async (betId: number) => {
    try {
      const success = await buyBet(betId);
      if (success) {
        setMessage('购买成功!');
        // 刷新数据
        fetchGambles();
      } else {
        setMessage('购买失败');
      }
    } catch (error) {
      console.error('购买失败:', error);
      setMessage('购买失败: ' + (error as Error).message);
    }
  };
  // 添加处理公布结果的函数
  const handleDeclareResult = async (gambleId: number, winningChoice: number) => {
    try {
      const success = await declareWinner(gambleId, winningChoice);
      setMessage(`宣布结果成功! 获胜选项: ${winningChoice}`);
      fetchGambles();
    } catch (error) {
      console.error('宣布结果失败:', error);
      setMessage('宣布结果失败: ' + (error as Error).message);
    }
  };

  // 添加处理结束竞猜的函数
  const handleFinishGamble = async (gambleId: number) => {
    try {
      const success = await finishGamble(gambleId);
      console.log(`结束赌局 ${gambleId}`);
      setMessage('结束竞猜成功!');
      fetchGambles();
    } catch (error) {
      console.error('结束竞猜失败:', error);
      setMessage('结束竞猜失败: ' + (error as Error).message);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Gamble 列表</h2>
        <Button onClick={fetchGambles}>刷新</Button>
      </div>
      
      {loading && <p>加载中...</p>}
      
      {message && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '4px',
          backgroundColor: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          marginBottom: '1rem'
        }}>
          {message}
        </div>
      )}
      
      {Object.entries(gambles).map(([id, gamble]) => (
        <div 
          key={id} 
          style={{ 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            backgroundColor: '#fff'
          }}
        >
          {/* 基础信息行 */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem',
              cursor: 'pointer'
            }}
            onClick={() => toggleExpand(parseInt(id))}
          >
            <div>
              <h3>Gamble #{id}</h3>
              <p>选项: {gamble.choices.length} 个</p>
            </div>
            <div>
              <p>奖金: {gamble.totalPrize} EBT</p>
              <p>截止: {gamble.deadline.toLocaleString()}</p>
            </div>
            <div>
              <p>状态: {gamble.finished ? '已结束' : '进行中'}</p>
              <Button variant="secondary">
                {expandedGamble === parseInt(id) ? '收起' : '详情'}
              </Button>
            </div>
          </div>
          
          {/* 展开的详细信息 */}
          {expandedGamble === parseInt(id) && (
            <div style={{ 
              borderTop: '1px solid #eee', 
              padding: '1rem' 
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <h4>选项详情:</h4>
                <ul>
                  {gamble.choices.map((choice, index) => (
                    <li key={index}>
                      {choice}
                    </li>
                  ))}
                </ul>
              </div>
              
              {!gamble.finished && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4>下注操作:</h4>
                  <PlaceBetForm 
                    gambleId={parseInt(id)}
                    gamble={gamble}
                    onPlaceBet={handlePlaceBet}
                  />
                </div>
              )}

              {/* 显示该 gamble 的 bets 列表 */}
              <div style={{ marginBottom: '1rem' }}>
                <h4>Bets 列表:</h4>
                {bets[parseInt(id)] && bets[parseInt(id)].length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {bets[parseInt(id)].map((bet) => (
                      <div 
                        key={bet.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '0.5rem',
                          border: '1px solid #eee',
                          borderRadius: '4px',
                          backgroundColor: '#f9f9f9'
                        }}
                      >
                        <div>
                          <p><strong>Bet ID:</strong> {bet.id}</p>
                          <p><strong>选项:</strong> {gamble.choices[parseInt(bet.betChoice)] || `选项 ${bet.betChoice}`}</p>
                          <p><strong>金额:</strong> {bet.betAmount} EBT</p>
                          <p><strong>状态:</strong> {bet.isListed ? '已挂单' : '未挂单'}</p>
                        </div>
                        <div>
                          {!bet.isListed && !gamble.finished && (
                            <ListBetInlineForm 
                              betId={bet.id} 
                              onListBet={handleListBet} 
                            />
                          )}
                          {bet.isListed && !gamble.finished && (
                            <span style={{ color: 'green' }}>已挂单</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>暂无 bets</p>
                )}
              </div>

              <OrderBookDisplay 
                gambleId={parseInt(id)} 
                onBuyBet={handleBuyBet} 
              />
              
              {!gamble.finished && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                  <h4>管理员操作</h4>
                  <DeclareResultForm 
                    gambleId={parseInt(id)}
                    gamble={gamble}
                    onDeclareResult={handleDeclareResult}
                    onFinishGamble={handleFinishGamble}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 下注表单组件
interface PlaceBetFormProps {
  gambleId: number;
  gamble: Gamble;
  onPlaceBet: (gambleId: number, amount: string, choice: number) => void;
}

const PlaceBetForm: React.FC<PlaceBetFormProps> = ({ gambleId, gamble, onPlaceBet }) => {
  const [amount, setAmount] = useState<string>('1');
  const [choice, setChoice] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onPlaceBet(gambleId, amount, choice);
      // 重置表单
      setAmount('1');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div>
        <label>金额 (EBT):</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0.1"
          step="0.1"
          required
          style={{ 
            padding: '0.25rem', 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            marginLeft: '0.5rem'
          }}
        />
      </div>
      
      <div>
        <label>选择:</label>
        <select
          value={choice}
          onChange={(e) => setChoice(parseInt(e.target.value))}
          style={{ 
            padding: '0.25rem', 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            marginLeft: '0.5rem'
          }}
        >
          {gamble.choices.map((choice, index) => (
            <option key={index} value={index}>
              {choice}
            </option>
          ))}
        </select>
      </div>
      
      <Button 
        type="submit" 
        disabled={loading}
        loading={loading}
      >
        {loading ? '下注中...' : '下注'}
      </Button>
    </form>
  );
};

// 内联挂单表单组件
const ListBetInlineForm: React.FC<{ 
  betId: number; 
  onListBet: (betId: number, price: string) => void 
}> = ({ betId, onListBet }) => {
  const [price, setPrice] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onListBet(betId, price);
      // 重置表单
      setPrice('1');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        min="0.1"
        step="0.1"
        required
        placeholder="价格"
        style={{ 
          padding: '0.25rem', 
          border: '1px solid #ccc', 
          borderRadius: '4px',
          width: '80px'
        }}
      />
      <Button 
        type="submit" 
        disabled={loading}
        variant="success"
        loading={loading}
      >
        {loading ? '挂单中...' : '挂单'}
      </Button>
    </form>
  );
};

interface DeclareResultFormProps {
  gambleId: number;
  gamble: Gamble;
  onDeclareResult: (gambleId: number, winningChoice: number) => void;
  onFinishGamble: (gambleId: number) => void;
}

const DeclareResultForm: React.FC<DeclareResultFormProps> = ({ 
  gambleId, 
  gamble, 
  onDeclareResult,
  onFinishGamble
}) => {
  const [winningChoice, setWinningChoice] = useState<number>(0);
  const [declareLoading, setDeclareLoading] = useState<boolean>(false);
  const [finishLoading, setFinishLoading] = useState<boolean>(false);

  const handleDeclareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeclareLoading(true);
    try {
      await onDeclareResult(gambleId, winningChoice);
    } finally {
      setDeclareLoading(false);
    }
  };

  const handleFinishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinishLoading(true);
    try {
      await onFinishGamble(gambleId);
    } finally {
      setFinishLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'center' }}>
      <form onSubmit={handleDeclareSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
        <div>
          <label>获胜选项:</label>
          <select
            value={winningChoice}
            onChange={(e) => setWinningChoice(parseInt(e.target.value))}
            style={{ 
              padding: '0.25rem', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              marginLeft: '0.5rem'
            }}
          >
            {gamble.choices.map((choice, index) => (
              <option key={index} value={index}>
                {index}: {choice}
              </option>
            ))}
          </select>
        </div>
        
        <Button 
          type="submit" 
          disabled={declareLoading}
          loading={declareLoading}
        >
          {declareLoading ? '公布中...' : '公布结果'}
        </Button>
      </form>
      
      <form onSubmit={handleFinishSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
        <Button 
          type="submit" 
          disabled={finishLoading}
          variant="danger"
          loading={finishLoading}
        >
          {finishLoading ? '结束中...' : '结束竞猜'}
        </Button>
      </form>
    </div>
  );
};