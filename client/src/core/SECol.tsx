import { Col, ColProps } from "antd";
import { createId } from "@paralleldrive/cuid2";

import React from "react";

export interface SECol extends ColProps {
  col?: number;
}

export const SECol = (props: SECol) => {
  return (
    <Col
      key={createId()}
      xs={24}
      sm={24}
      md={props.col || 24}
      span={props.col || 24}
      {...props}
    >
      {React.Children.map(props.children, (child, index) => child)}
    </Col>
  );
};
