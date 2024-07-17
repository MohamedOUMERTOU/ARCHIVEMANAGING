import React, { StrictMode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SELayout from "./components/layout/Layout";

const App: React.FC = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <SELayout />,
    },
  ]);
  return (
      <RouterProvider router={router} />
  );
};

export default App;
