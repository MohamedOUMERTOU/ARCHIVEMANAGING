import React, { FC } from 'react'
import SEForm from '../../../../core/SEForm'
import SETextInput from '../../../../core/SETextInputs'
import SEButton from '../../../../core/SEButton'

const MetaDataForm:FC = () => {


  return (
    <SEForm onSubmit={()=>{}}>
    <SETextInput name="code"label="Code " onChange={()=>{}}/>
    <SETextInput name="name" label="Nom " onChange={()=>{}}/>
    <SETextInput name="description" label="Description " onChange={()=>{}}/>
    <SEButton htmlType="submit"  isSubmit label="sauvegarde"type="primary" onClick={()=>{}}/>
    </SEForm>
  )
}

export default MetaDataForm
