import React, { FC, useState } from 'react'
import SETypography from '../../../../core/SETypography'
import ListAction from './ListAction'
import SECol from '../../../../core/SECol'
import SEDivider from '../../../../core/SEDIvider'
import SEButton from '../../../../core/SEButton'
import SEDrawer from '../../../../core/SEDrawer'
import ActionForm from './ActionForm'

const Index: FC= () => {
  const [visible, setVisible]=useState(false)
  const openDrawer=()=>{
    
   setVisible(true)
  }
 const closeDrawer=()=>{
    
    setVisible(false)
   }
  return (
    <>
    <SECol  span={24} offset={8}>
    <SETypography text=' Liste des actions' level={3} />
    </SECol>
    <SEDrawer title='Ajouter une action' visible={visible} placement='right'  onClose={closeDrawer}>
      
      <ActionForm/>
    </SEDrawer>
    <SEDivider/>
    <SECol  span={24} offset={8} >
    <SEButton label=' Ajouter une action' col={12}  type='primary' htmlType='submit' onClick={openDrawer}/>
    </SECol>
    <ListAction/>
      
    </>
  )
}

export default Index
