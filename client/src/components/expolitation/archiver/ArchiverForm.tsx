import React from 'react'
import SEForm from '../../../core/SEForm'
import SESelect from '../../../core/SESelect'
import TypeDocSearch from '../search/TypeDocSearch'

const ArchiverForm = () => {
  return (
    <>
    <SEForm onSubmit={()=>{}}>
    <SESelect name='type document' label='selectionner type document'/> 
 </SEForm>
<TypeDocSearch/>
</>
  )
}

export default ArchiverForm
