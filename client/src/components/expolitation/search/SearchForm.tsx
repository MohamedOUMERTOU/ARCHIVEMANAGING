import { FC, useState } from 'react'
import SEForm from '../../../core/SEForm'
import SESelect from '../../../core/SESelect'
import SearchGrid from './SearchGrid'
import TypeDocSearch from './TypeDocSearch'

const SearchForm :FC= () => {
    const [typedoc, SetTypedoc]=useState();
  return (
    <>
    <SEForm onSubmit={()=>{}}>
       <SESelect name='type document' label='selectionner type document'/> 
    </SEForm>
   <TypeDocSearch/>
    <SearchGrid/>

</>
  )
}

export default SearchForm
