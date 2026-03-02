package com.spendsense.service;

import com.spendsense.dto.response.UserResponse;
import com.spendsense.exception.ResourceNotFoundException;
import com.spendsense.mapper.UserMapper;
import com.spendsense.model.User;
import com.spendsense.model.enums.UserRole;
import com.spendsense.model.webhook.ClerkUserData;
import com.spendsense.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserService {
    private final UserRepository userRepository;
    private final UserMapper userMapper;

    // called by clerkwebhook when user is created
    public User createUserFromClerk(ClerkUserData clerkData) {
        return userRepository.findByClerkUserId(clerkData.getId())
                .orElseGet(() -> {
                    User user = new User();
                    user.setClerkUserId(clerkData.getId());
                    user.setEmail(clerkData.getEmail());
                    user.setName(buildFullName(clerkData.getFirstName(), clerkData.getLastName()));
                    user.setImageUrl(clerkData.getImageUrl());
                    return userRepository.save(user);
                });

    }

    public User updateUserFromClerk(ClerkUserData clerkData) {
        User user = userRepository.findByClerkUserId(clerkData.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setEmail(clerkData.getEmail());
        user.setName(buildFullName(clerkData.getFirstName(), clerkData.getLastName()));
        user.setImageUrl(clerkData.getImageUrl());
        // @UpdateTimestamp on the entity handles updatedAt automatically

        return userRepository.save(user);
    }

    public void deleteUserFromClerk(String clerkUserId) {
        Optional<User> userOptional = userRepository.findByClerkUserId(clerkUserId);

        if (userOptional.isPresent()) {
            userRepository.delete(userOptional.get());
            log.info("User deleted from Clerk: {}", clerkUserId);
        } else {
            log.warn("User delete webhook received for non-existent user: {}", clerkUserId);
        }
    }

    // Get current user
    public UserResponse getCurrentUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return userMapper.toResponse(user);
    }

    // admin:get all users
    public List<UserResponse> findAll() {
        return userRepository.findAll()
                .stream()
                .map(userMapper::toResponse)
                .collect(Collectors.toList());
    }

    // admin: update user role
    public User updateRole(UUID userId, UserRole role) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User Not found"));
        user.setRole(role);
        // @UpdateTimestamp on the entity handles updatedAt automatically
        return userRepository.save(user);
    }

    public void delete(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User Not found"));
        userRepository.delete(user);
    }

    // Get or Create user (JIT for Auth)
    public User getOrCreateUser(String clerkUserId) {
        return userRepository.findByClerkUserId(clerkUserId)
                .orElseGet(() -> {
                    User user = new User();
                    user.setClerkUserId(clerkUserId);
                    user.setName("New User"); // Placeholder until webhook updates it
                    return userRepository.save(user);
                });
    }

    private String buildFullName(String firstName, String lastName) {
        if (firstName == null && lastName == null) {
            return null;
        }
        if (firstName == null) {
            return lastName;
        }
        if (lastName == null) {
            return firstName;
        }
        return firstName + " " + lastName;
    }
}
