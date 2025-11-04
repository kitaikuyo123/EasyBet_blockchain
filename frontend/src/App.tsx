import React from 'react';
import './App.css';
import Header from './component/Header';
import GambleCreate from './component/GambleCreate';
import GambleList from './component/GambleDisplay';

function App() {
  return (
    <div className="App">
      <Header />
      
      <main>
        <GambleCreate />
        <GambleList />
      </main>
    </div>
  );
}

export default App;