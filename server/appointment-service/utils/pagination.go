package utils

import (
	"strconv"
	"strings"
)

// PaginationMetadata represents standard pagination info returned in API response meta.
type PaginationMetadata struct {
	TotalItems  int  `json:"totalItems"`
	Page        int  `json:"page"`
	Limit       int  `json:"limit"`
	TotalPages  int  `json:"totalPages"`
	HasNextPage bool `json:"hasNextPage"`
	HasPrevPage bool `json:"hasPrevPage"`
}

// CalculatePagination calculates pagination fields from totalItems, page, and limit.
func CalculatePagination(totalItems, page, limit int) PaginationMetadata {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (totalItems + limit - 1) / limit
	}

	return PaginationMetadata{
		TotalItems:  totalItems,
		Page:        page,
		Limit:       limit,
		TotalPages:  totalPages,
		HasNextPage: page < totalPages,
		HasPrevPage: page > 1,
	}
}

// ParsePaginationParams parses 'page' and 'per_page' / 'limit' query parameters.
func ParsePaginationParams(pageStr, limitStr string, defaultLimit, maxLimit int) (page int, limit int, offset int) {
	if defaultLimit <= 0 {
		defaultLimit = 20
	}
	if maxLimit <= 0 {
		maxLimit = 100
	}

	page, err := strconv.Atoi(strings.TrimSpace(pageStr))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err = strconv.Atoi(strings.TrimSpace(limitStr))
	if err != nil || limit < 1 {
		limit = defaultLimit
	} else if limit > maxLimit {
		limit = maxLimit
	}

	offset = (page - 1) * limit
	return page, limit, offset
}

