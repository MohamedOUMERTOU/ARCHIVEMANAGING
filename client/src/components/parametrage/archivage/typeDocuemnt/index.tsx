import React, { useState } from "react";
import SEButton from "../../../../core/SEButton";
import SECol from "../../../../core/SECol";
import SEDivider from "../../../../core/SEDIvider";
import SEDrawer from "../../../../core/SEDrawer";
import { Icons } from "../../../../core/SEIcons";
import SETypography from "../../../../core/SETypography";
import ListTypeDocument from "./ListTypeDocument";
import TypeForm from "./TypeForm";
const Types = () => {
  const [visible, setVisible] = useState(false);

  const showDrawer = () => {
    setVisible(true);
  };

  const onClose = () => {
    setVisible(false);
  };
  return (
    <>
      <SECol span={24} offset={8}>
        <SETypography text="Gestion des types des documents" level={3} />
      </SECol>
      <SEDivider />
      <SEDrawer
        width={500}
        placement="right"
        title="Ajouter un type"
        visible={visible}
        onClose={onClose}
      >
        <TypeForm />
      </SEDrawer>
      <SECol span={24} offset={21}>
        <SEButton
        htmlType='submit'
          onClick={showDrawer}
          style={{ marginBottom: "10px" }}
          label="Ajouter type"
          icon={<Icons.PlusOutlined />}
          col={24}
          type="primary"
        />
      </SECol>

      <ListTypeDocument />
    </>
  );
};

export default Types;
