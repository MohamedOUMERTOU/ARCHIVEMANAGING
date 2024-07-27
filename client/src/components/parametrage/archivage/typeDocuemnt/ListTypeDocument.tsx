import { Input, TableColumnProps, TableProps } from 'antd';
import React, { Key, useState } from 'react';
import SEButton from '../../../../core/SEButton';
import { Icons } from '../../../../core/SEIcons';
import SEgrid from '../../../../core/SEgrid';

const ListTypeDocument = () => {
   const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
   const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
   const [filterValue, setFilterValue] = useState<string>("");
   const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterValue(e.target.value);
    };
  
    const applyFilter = () => {
    /*   const filtered = users.filter((user) =>
        user.username.toLowerCase().includes(filterValue.toLowerCase())
      );
      setFilteredUsers(filtered); */
    };
  
    const columns: TableColumnProps<any>[] = [
      {
        title: "Libellé type",
        dataIndex: "Libellé type",
        key: "Libellé type",
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
    <SEgrid
          columns={columns}
          data={filteredUsers}
          rowSelection={rowSelection}
        />
    </>
  )
}

export default ListTypeDocument