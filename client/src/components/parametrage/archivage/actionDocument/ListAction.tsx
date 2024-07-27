import { FC } from 'react'
import SEgrid from '../../../../core/SEgrid'


const ListAction :FC= () => {
    const column=[
        {title: "Nom d'action",
        dataIndex: "username",
        key: "1",},
        {title: "Description",
            dataIndex: "username",
            key: "2",},
           
            ]
  return (
   

    <>

    <SEgrid data={[]}columns={column}col={12}/>
    
    </>
  )
}

export default ListAction


