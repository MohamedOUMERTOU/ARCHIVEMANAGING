import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SELayout from "./components/layout/Layout";
import ListUsers from "./components/parametrage/utilisateurs/ListUsers";
import ArchiveParams from "./components/parametrage/archivage/ArchiveParams";

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
        {
          path: "/Paramètrage/Archivage",
          element: <ArchiveParams />,
        },
      ],
    },
  ]);
  return <RouterProvider router={router} />;
};

export default App;
