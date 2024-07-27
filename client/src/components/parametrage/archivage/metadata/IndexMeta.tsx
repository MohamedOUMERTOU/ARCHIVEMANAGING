import React, { useContext, useEffect, useState } from 'react'
import SECol from '../../../../core/SECol'
import SETypography from '../../../../core/SETypography'
import SEDrawer from '../../../../core/SEDrawer'
import MetaDataForm from './MetaDataForm'
import SEDivider from '../../../../core/SEDIvider'
import SEButton from '../../../../core/SEButton'
import ListMetadata from './ListMetadata'
import { SEContext } from '../../../../context/userSEContext'

const IndexMeta = () => {
  const [visible, setVisible] = useState(false);


  const closeDrawer = () => {
    setVisible(false);
    
  };
   const openDrawer = () => {
    setVisible(true);
   }
  return (
 <>
 <SECol span={24} offset={8}>
        <SETypography text="Liste des infromation de dossier" level={3} />
    </SECol>
    <SEDrawer title="Ajouter une Metadata" visible={visible} placement="right" onClose={closeDrawer}>
        <MetaDataForm  />
      </SEDrawer>
      <SEDivider />
      <SECol span={24} offset={20}>
        <SEButton label="Ajouter une Metadata" col={12} type="primary" htmlType="submit" onClick={openDrawer} />
      </SECol>
      <ListMetadata />
 
 </>
  )
}

export default IndexMeta
