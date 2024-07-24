package com.sea.systemarchivephysic.dtos;

public class UserDto {
    private Long code;
    private String label;

    public UserDto(Long code, String label) {
        this.code = code;
        this.label = label;
    }

    public Long getCode() {
        return code;
    }

    public void setCode(Long code) {
        this.code = code;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }
}
