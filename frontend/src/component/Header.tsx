import React, { useState, useEffect } from 'react';
import { faucet, getBalance, getAccount, initContracts, setupAccountChangeListener } from '../contract_utils';

export default function Header() {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);

  // 获取账户信息和余额
  const loadAccountInfo = async () => {
    try {
      // 获取账户信息
      const accountAddress = await getAccount();
      setAccount(accountAddress);
      
      // 获取余额
      const balanceValue = await getBalance();
      setBalance(balanceValue);
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 初始化合约
        const initialized = await initContracts();
        if (initialized) {
          // 首次加载账户信息
          await loadAccountInfo();
          
          // 设置账户变化监听器
          setupAccountChangeListener((newAccount: string) => {
            console.log("账户已变更到:", newAccount);
            // 当账户变化时重新加载信息
            loadAccountInfo();
          });
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();

    // 清理函数 - 组件卸载时移除监听器
    return () => {
      if (typeof window.ethereum !== 'undefined') {
        // 移除 accountsChanged 监听器
        window.ethereum.removeListener('accountsChanged', loadAccountInfo);
      }
    };
  }, []);

  const handleFaucet = async () => {
    setLoading(true);
    try {
      const success = await faucet();
      if (success) {
        // 更新余额
        const newBalance = await getBalance();
        setBalance(newBalance);
        alert('成功领取100 EBT代币!');
      } else {
        alert('领取失败，请查看控制台了解详情');
      }
    } catch (error) {
      console.error('Faucet error:', error);
      alert('领取失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem 2rem', 
      backgroundColor: '#f5f5f5', 
      borderBottom: '1px solid #ddd' 
    }}>
      <h1>EasyBet DApp</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Account account={account} />
        <Balance balance={balance} />
        <Faucet onFaucet={handleFaucet} loading={loading} />
      </div>
    </header>
  );
}

function Account({ account }: { account: string | null }) {
  return (
    <section>
      <div className="gamble-basic-info">
        <h3>Account</h3>
        <p>{account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : '未连接'}</p>
      </div>
    </section>
  );
}

function Faucet({ onFaucet, loading }: { onFaucet: () => void, loading: boolean }) {
  return (
    <section>
      <div className="gamble-basic-info">
        <h3>Faucet</h3>
        <button 
          onClick={onFaucet} 
          disabled={loading}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '领取中...' : '领取100 EBT'}
        </button>
      </div>
    </section>
  );
}

function Balance({ balance }: { balance: string }) {
  return (
    <section>
      <div className="gamble-basic-info">
        <h3>Balance</h3>
        <p>{balance} EBT</p>
      </div>
    </section>
  );
}