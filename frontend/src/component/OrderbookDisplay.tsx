import React, { useState, useEffect } from 'react';
import { getOrderBook, getGamble, getBet } from '../contract_utils';
import { Button } from './common';

interface OrderBookEntry {
  price: string;
  choiceId: string;
  betId: string;
  owner?: string; // 添加所有者字段
}

interface OrderBookDisplayProps {
  gambleId: number;
  onBuyBet?: (betId: number) => void; // 添加购买函数
}

export default function OrderBookDisplay({ gambleId, onBuyBet }: OrderBookDisplayProps) {
  const [orderBook, setOrderBook] = useState<OrderBookEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [gambleChoices, setGambleChoices] = useState<string[]>([]);

  const fetchOrderBook = async () => {
    setLoading(true);
    try {
      const [orderBookData, gambleData] = await Promise.all([
        getOrderBook(gambleId),
        getGamble(gambleId)
      ]);
      
      // 获取每个订单的所有者信息
      const orderBookWithOwners: OrderBookEntry[] = [];
      for (const entry of orderBookData) {
        try {
          const betData = await getBet(parseInt(entry.betId));
          orderBookWithOwners.push({
            ...entry,
            owner: betData?.owner
          });
        } catch (error) {
          console.error(`获取 bet ${entry.betId} 信息失败:`, error);
          orderBookWithOwners.push(entry); // 即使获取所有者失败也保留原始数据
        }
      }
      
      setOrderBook(orderBookWithOwners);
      if (gambleData) {
        setGambleChoices(gambleData.choices);
      }
    } catch (error) {
      console.error('获取订单簿失败:', error);
      setMessage('获取订单簿失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gambleId !== undefined) {
      fetchOrderBook();
    }
  }, [gambleId]);

  const handleBuy = async (betId: string) => {
    if (onBuyBet) {
      try {
        await onBuyBet(parseInt(betId));
        setMessage('购买成功!');
        // 刷新订单簿
        fetchOrderBook();
      } catch (error) {
        console.error('购买失败:', error);
        setMessage('购买失败: ' + (error as Error).message);
      }
    }
  };

  if (loading) return <p>加载订单簿中...</p>;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>订单簿</h4>
        <Button onClick={fetchOrderBook} variant="secondary">刷新</Button>
      </div>
      
      {message && (
        <div style={{
          padding: '0.5rem',
          borderRadius: '4px',
          backgroundColor: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          marginBottom: '0.5rem'
        }}>
          {message}
        </div>
      )}
      
      {orderBook.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {orderBook.map((entry, index) => (
            <div 
              key={index} 
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
                <p><strong>Bet ID:</strong> {entry.betId}</p>
                {entry.owner && (
                  <p><strong>所有者:</strong> {entry.owner.substring(0, 6)}...{entry.owner.substring(entry.owner.length - 4)}</p>
                )}
                <p><strong>选项:</strong> {gambleChoices[parseInt(entry.choiceId)] || `选项 ${entry.choiceId}`}</p>
                <p><strong>价格:</strong> {entry.price} EBT</p>
              </div>
              <div>
                {onBuyBet ? (
                  <Button 
                    onClick={() => handleBuy(entry.betId)} 
                    variant="primary" 
                  >
                    购买
                  </Button>
                ) : (
                  <span>可购买</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>暂无挂单</p>
      )}
    </div>
  );
}