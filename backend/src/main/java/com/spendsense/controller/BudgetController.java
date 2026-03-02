package com.spendsense.controller;

import com.spendsense.dto.request.CreateBudgetRequest;
import com.spendsense.dto.request.UpdateBudgetRequest;
import com.spendsense.dto.response.BudgetResponse;
import com.spendsense.model.User;
import com.spendsense.security.UserPrincipal;
import com.spendsense.service.BudgetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/budget")
@RequiredArgsConstructor
@Tag(name = "Budget", description = "Budget management APIs")
public class BudgetController {
    private final BudgetService budgetService;
    private final UserPrincipal userPrincipal;

    @PostMapping
    @Operation(summary = "Create a new budget", description = "Creates a new budget for the user")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Budget created successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request"),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public ResponseEntity<BudgetResponse> createBudget(
            Authentication authentication,
            @Valid @RequestBody CreateBudgetRequest request
            ){
        User user=userPrincipal.getCurrentUser(authentication);
        BudgetResponse response=budgetService.createBudget(user.getId(),request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "Get user budget", description = "Retrieves the budget for the authenticated user")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Budget retrieved successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Budget not found")
    })
    public ResponseEntity<BudgetResponse> getBudget(
            Authentication authentication
    ){
        User user=userPrincipal.getCurrentUser(authentication);
        BudgetResponse response=budgetService.getUserBudget(user.getId());
        return ResponseEntity.ok(response);
    }

    @PutMapping
    @Operation(summary = "Update budget", description = "Updates the user's budget")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Budget updated successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Budget not found")
    })
    public ResponseEntity<BudgetResponse> updateBudget(
            Authentication authentication,
            @Valid @RequestBody UpdateBudgetRequest request
    ){
        User user=userPrincipal.getCurrentUser(authentication);
        BudgetResponse response=budgetService.updateBudget(user.getId(),request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping
    @Operation(summary = "Delete budget", description = "Deletes the user's budget")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Budget deleted successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Budget not found")
    })
    public ResponseEntity<Void> deleteBudget(
            Authentication authentication
    ){
        User user=userPrincipal.getCurrentUser(authentication);
        budgetService.deleteBudget(user.getId());
        return ResponseEntity.noContent().build();
    }
}
