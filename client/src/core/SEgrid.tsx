import React, { CSSProperties } from "react";
import { Col, Table, TableProps } from "antd";

interface SEgridProps extends TableProps<any> {
  data: any[];
  columns: any[];
  col?: number;
  rowSelection?: TableProps<any>['rowSelection']; // Add rowSelection prop
  style?: CSSProperties ;// Add color prop
}

const SEgrid: React.FC<SEgridProps> = ({ data, columns, col = 24, rowSelection, style, ...TableProps }) => {
  return (
    <Col span={col} style={{ ...style}}>
      <Table 
        columns={columns}
        dataSource={data}
        rowSelection={rowSelection} // Pass rowSelection to Table
        {...TableProps}
       
      />
    </Col>
  );
};

export default SEgrid;
