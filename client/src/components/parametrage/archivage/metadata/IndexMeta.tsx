import { useContext, useEffect, useState } from 'react'
import SEButton from '../../../../core/SEButton'
import SECol from '../../../../core/SECol'
import SEDivider from '../../../../core/SEDIvider'
import SEDrawer from '../../../../core/SEDrawer'
import SETypography from '../../../../core/SETypography'
import ListMetadata from './ListMetadata'
import MetaDataForm from './MetaDataForm'
import { SEContext } from '../../../../context/userSEContext'

const IndexMeta = () => {
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
        <SETypography text="Liste des infromation de dossier" level={3} />
    </SECol>
      <SEDivider />
      <SECol span={24} offset={20}>
        <SEButton label="Ajouter" col={12} type="primary" htmlType="submit" onClick={openDrawer} />
      </SECol>
      <ListMetadata />
      <SEDrawer title="Ajouter une Metadata" visible={visible} placement="right" onClose={closeDrawer}>
        <MetaDataForm  />
      </SEDrawer>
 </>
  )
}

export default IndexMeta
