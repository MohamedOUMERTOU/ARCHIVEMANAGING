import React, { FC } from "react";
import SEForm from "../../../../core/SEForm";
import SETextInput from "../../../../core/SETextInputs";
import { SECol } from "../../../../core/SECol";

const ListUsers: FC = () => {
  return (
    <>
      <SEForm
        onSubmit={() => {
          console.log("test");
        }}
        submitLabel="Submit"
      >
        <SECol col={12}>
          <SETextInput
            name="test"
            value="value"
            onChange={(event: any) => {}}
          />
        </SECol>
      </SEForm>
    </>
  );
};

export default ListUsers;
