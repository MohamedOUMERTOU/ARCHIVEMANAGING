import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SELayout from "./components/layout/Layout";
import ListUsers from "./components/parametrage/utilisateurs/ListUsers";
import ArchiveParams from "./components/parametrage/archivage/ArchiveParams";
import SearchForm from "./components/expolitation/search/SearchForm";

const App: React.FC = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <SELayout />,
      children: [
        {
          path: "Paramètrage/Utilisateurs",
          element: <ListUsers />,
        },
        {
          path: "/Paramètrage/Archivage",
          element: <ArchiveParams />,
        },
        {
          path: "/Archivage/Recherche",
          element: <SearchForm />,
        },
        {
          path: "/Archivage/Archivage",
          element: <SearchForm />,
        },
      ],
    },
  ]);
  return <RouterProvider router={router} />;
};

export default App;
