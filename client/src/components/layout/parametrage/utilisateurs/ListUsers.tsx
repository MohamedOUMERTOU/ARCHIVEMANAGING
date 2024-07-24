import { Input, TableColumnProps, TableProps } from "antd";
import cuid from "cuid"; // Ensure you have cuid installed or use another unique ID generator
import React, { FC, Key, useContext, useEffect, useState } from "react";
import SEButton from "../../../../core/SEButton";
import SECol from "../../../../core/SECol";
import SEgrid from "../../../../core/SEgrid";
import { Icons } from "../../../../core/SEIcons";
import SERow from "../../../../core/SERow";
import SETypography from "../../../../core/SETypography";
import { getUtilisateurs } from "./usersApis";
import { SEContext } from "../../../../context/userSEContext";


const ListUsers: FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [filterValue, setFilterValue] = useState<string>("");
  const context = useContext(SEContext);
  if (!context) {
    throw new Error("ListUsers must be used within a SEContextProvider");
  }
  const { axes } = context;
 console.log('-------',axes);
 
  useEffect(() => {
    getUtilisateurs();
    const storedUsers = localStorage.getItem("users");
    if (storedUsers) {
      const userData = JSON.parse(storedUsers).map((user: any) => ({
        ...user,
        key: cuid(),
      }));
      setUsers(userData);
      setFilteredUsers(userData); // Set initial filtered data
    }
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterValue(e.target.value);
  };

  const applyFilter = () => {
    const filtered = users.filter((user) =>
      user.username.toLowerCase().includes(filterValue.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  const columns: TableColumnProps<any>[] = [
    {
      title: "Nom",
      dataIndex: "username",
      key: "username",
      filterDropdown: () => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Enter username"
            value={filterValue}
            onChange={handleFilterChange}
            onPressEnter={applyFilter}
            style={{ marginBottom: 8, display: "block" }}
          />
          <SEButton
            label="Filter"
            type="primary"
            onClick={applyFilter}
            icon={<Icons.FileDoneOutlined />}
          />
        </div>
      ),
      onFilter: (value: string | number | boolean | Key, record: any) =>
        record.username.toLowerCase().includes(filterValue.toLowerCase()),
    },
    // Add more columns as needed
  ];

  const rowSelection: TableProps<any>["rowSelection"] = {
    selectedRowKeys,
    onChange: (selectedRowKeys: Key[]) => {
      setSelectedRowKeys(selectedRowKeys);
    },
  };

  return (
    <>
      <SETypography text="Gestion des utilisateurs" level={2} />
      <SERow>
        <SECol span={24} offset={22}>
          <SEButton
            label="Ajouter"
            icon={<Icons.FileDoneOutlined />}
            style={{
              backgroundColor: "#22ab47",
              color: "white",
              margin: "5px",
            }}
          />
        </SECol>
      </SERow>

      <SECol span={24}>
        <SEgrid
          columns={columns}
          data={filteredUsers}
          rowSelection={rowSelection}
        />
      </SECol>
    </>
  );
};

export default ListUsers;
