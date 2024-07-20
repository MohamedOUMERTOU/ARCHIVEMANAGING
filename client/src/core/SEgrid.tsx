import React from "react";
import { Table,TableProps } from "antd";

interface SEgridProps extends TableProps<any> {
  data: any[];
  columns: any[];
}
const SEgrid: React.FC<SEgridProps> = ({ data, columns,...TableProps  }) => {
  return (
     <Table columns={columns} dataSource={data} {...TableProps}/>
     
  );
};

export default SEgrid;
