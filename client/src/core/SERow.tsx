import { createId } from '@paralleldrive/cuid2';
import { Row } from "antd";
import { has } from "lodash";
import React from "react";
import { SECol } from "./SECol";

export const MSRow = (props: any) => {
  return (
    <Row gutter={props.gutter || [8, 8]} key={createId()} {...props}>
      {React.Children.map(props.children, (child, index) => {
        if (!has(child, "props")) return null;

        return child.type && child.type.name === SECol.name ? (
          child
        ) : (
          <SECol col={child.props.col}>{child}</SECol>
        );
      })}
    </Row>
  );
};