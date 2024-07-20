import React from "react";
import { Table, TableProps } from "antd";

interface SEgridProps extends TableProps<any> {
  data: any[];
  columns: any[];
  rowSelection?: TableProps<any>['rowSelection']; // Add rowSelection prop
}

const SEgrid: React.FC<SEgridProps> = ({ data, columns, rowSelection, ...TableProps }) => {
  return (
      <Table
        columns={columns}
        dataSource={data}
        rowSelection={rowSelection} // Pass rowSelection to Table
        {...TableProps}
      />
  );
};

export default SEgrid;
