import React from 'react'
import SEgrid from '../../../../core/SEgrid'

const ListMetadata = () => {
    const columns = [
        {
          title: "ID",
          dataIndex: "idOperation",
          key: "idOperation",
        },
        {
          title: "Name",
          dataIndex: "name",
          key: "name",
        },
        {
          title: "Description",
          dataIndex: "description",
          key: "description",
        }
      ];
  return (
    <SEgrid
        data={[]}
        columns={columns}
        col={24}
        
      />
  )
}

export default ListMetadata
