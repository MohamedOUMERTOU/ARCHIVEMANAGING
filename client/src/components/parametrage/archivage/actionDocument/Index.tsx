import React, { FC, useContext, useEffect, useState } from 'react';
import SETypography from '../../../../core/SETypography';
import ListAction from './ListAction';
import SECol from '../../../../core/SECol';
import SEDivider from '../../../../core/SEDIvider';
import SEButton from '../../../../core/SEButton';
import SEDrawer from '../../../../core/SEDrawer';
import ActionForm from './ActionForm';
import { SEContext } from '../../../../context/userSEContext';

const Index: FC = () => {
  const [visible, setVisible] = useState(false);
  const context = useContext(SEContext);

  if (!context) {
    throw new Error("SEContext must be used within a SEContextProvider");
  }

  const { closeDr, setCloseDr } = context;

  useEffect(() => {
    if (closeDr) {
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, [closeDr]);

  const openDrawer = () => {
    setCloseDr(false);
  };

  const closeDrawer = () => {
    setVisible(false);
    setCloseDr(true);
  };

  return (
    <>
      <SECol span={24} offset={8}>
        <SETypography text="Liste des actions" level={3} />
      </SECol>
      <SEDrawer title="Ajouter une action" visible={visible} placement="right" onClose={closeDrawer}>
        <ActionForm />
      </SEDrawer>
      <SEDivider />
      <SECol span={24} offset={8}>
        <SEButton label="Ajouter une action" col={12} type="primary" htmlType="submit" onClick={openDrawer} />
      </SECol>
      <ListAction />
    </>
  );
};

export default Index;
