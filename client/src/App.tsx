import React from 'react';
import { Route, Routes } from 'react-router-dom';
import SELayout from './components/layout/Layout';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<SELayout />}>
      </Route>
    </Routes>
  );
};

export default App;
