import React from "react";
import { Table,TableProps  } from "antd";

interface SEgridProps extends TableProps<any> {
  data: any[];
  columns: any[];
}
const SEgrid: React.FC<SEgridProps> = ({ data, columns,...TableProps  }) => {
  return (
    <div style={{ padding: 24, background: "#fff", minHeight: 500 }}>
      <Table columns={columns} dataSource={data} {...TableProps}/>
    </div>
  );
};

export default SEgrid;
