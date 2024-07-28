import React, { FC } from 'react'
import SEForm from '../../../core/SEForm'
import SETextInput from '../../../core/SETextInputs'

const TypeDocSearch:FC = () => {
  return (
<SEForm onSubmit={()=>{}}>
<SETextInput name=' document' label='Nom' onChange={()=>{}}/> 
<SETextInput name='type ' label='Annee' onChange={()=>{}}/> 
<SETextInput name='type document' label='Fillière' onChange={()=>{}}/> 
<SETextInput name='type document' label='Promotion' onChange={()=>{}}/> 
<SETextInput name='type document' label='Ville' onChange={()=>{}}/> 
</SEForm>
  )
}

export default TypeDocSearch
