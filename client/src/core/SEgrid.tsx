import React, { CSSProperties } from "react";
import { Col, Table, TableProps } from "antd";

interface SEgridProps extends TableProps<any> {
  data: any[];
  columns: any[];
  col?: number;
  onRowClick?: (record: any) => void; // Add onRowClick prop
  style?: CSSProperties; // Add style prop
}

const SEgrid: React.FC<SEgridProps> = ({ data, columns, col = 24, onRowClick, style, ...TableProps }) => {
  return (
    <Col span={col} style={{ ...style }}>
      <Table
        columns={columns}
        dataSource={data}
        onRow={(record) => ({
          onClick: () => onRowClick?.(record), // Call the callback on row click
        })}
        {...TableProps}
      />
    </Col>
  );
};

export default SEgrid;
