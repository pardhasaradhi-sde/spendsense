package com.spendsense.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpendingInsightResponse implements Serializable {
    private String summary;
    private List<String> recommendations;
    private List<String> patterns;
    private List<String> topCategories;
    private List<String> anomalies;
}