import React, { useState } from 'react';
import { createGamble } from '../contract_utils';
import {InputField, Button, ChoiceInput} from './common';

export default function GambleCreate() {
  const [choices, setChoices] = useState<string[]>(['', '']);
  const [totalPrize, setTotalPrize] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  const addChoice = () => {
    setChoices([...choices, '']);
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 2) {
      setMessage('至少需要2个选项');
      return;
    }
    const newChoices = [...choices];
    newChoices.splice(index, 1);
    setChoices(newChoices);
    setMessage('');
  };

  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证输入
    if (choices.some(choice => !choice.trim())) {
      setMessage('所有选项都必须填写');
      return;
    }
    
    if (!totalPrize || parseFloat(totalPrize) <= 0) {
      setMessage('奖金必须大于0');
      return;
    }
    
    if (!deadline) {
      setMessage('请选择截止时间');
      return;
    }
    
    const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    if (deadlineTimestamp <= currentTimestamp) {
      setMessage('截止时间必须在将来');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const success = await createGamble(choices, totalPrize, deadlineTimestamp);
      
      if (success) {
        setMessage('Gamble 创建成功!');
        // 重置表单
        setChoices(['', '']);
        setTotalPrize('');
        setDeadline('');
      } else {
        setMessage('Gamble 创建失败，请查看控制台了解详情');
      }
    } catch (error) {
      console.error('Create gamble error:', error);
      setMessage('创建失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '2rem auto', 
      padding: '2rem', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h2>创建新的 Gamble</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            选项列表: <span style={{ color: 'red' }}>*</span>
          </label>
          
          {choices.map((choice, index) => (
            <ChoiceInput
              key={index}
              index={index}
              value={choice}
              onChange={(value) => updateChoice(index, value)}
              onRemove={() => removeChoice(index)}
              canRemove={choices.length > 2}
            />
          ))}
          
          <Button 
            type="button" 
            onClick={addChoice}
            variant="success"
          >
            添加选项
          </Button>
        </div>
        
        <InputField
          label="总奖金 (EBT)"
          type="number"
          value={totalPrize}
          onChange={setTotalPrize}
          placeholder="输入总奖金数量"
          min="0"
          step="0.1"
          required
        />
        
        <InputField
          label="截止时间"
          type="datetime-local"
          value={deadline}
          onChange={setDeadline}
          required
        />
        
        <div style={{ marginTop: '1.5rem' }}>
          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            loading={loading}
          >
            创建 Gamble
          </Button>
        </div>
      </form>
      
      {message && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          borderRadius: '4px',
          backgroundColor: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('成功') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}
    </div>
  );
}