import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SELayout from "./components/layout/Layout";
import ListUsers from "./components/layout/parametrage/utilisateurs/ListUsers";

const App: React.FC = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <SELayout />,
      children: [
        {
          path: "/Paramètrage/Utitlisateurs",
          element: <ListUsers />,
        },
      ],
    },
  ]);
  return <RouterProvider router={router} />;
};

export default App;
