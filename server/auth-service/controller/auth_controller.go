// Package controller exposes auth-service HTTP endpoints.
package controller

import (
	"net/http"

	"github.com/woreda/booking/auth-service/model"
	"github.com/woreda/booking/auth-service/service"
)

// AuthCookieName is the standard cookie name for the JWT access token.
const AuthCookieName = "woreda_token"

func setTokenCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     AuthCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
	})
}

// Controller serves /api/v1/auth.
type Controller struct{ svc *service.AuthService }

// New builds a Controller.
func New(svc *service.AuthService) *Controller { return &Controller{svc: svc} }

// Register handles POST /auth/register.
func (ctl *Controller) Register(w http.ResponseWriter, r *http.Request) {
	var req model.RegisterRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	res, err := ctl.svc.Register(r.Context(), req)
	if err != nil {
		fail(w, r, err)
		return
	}
	setTokenCookie(w, res.Token, 7*24*3600)
	OK(w, http.StatusCreated, "Citizen account registered successfully.", res)
}

// Login handles POST /auth/login.
func (ctl *Controller) Login(w http.ResponseWriter, r *http.Request) {
	var req model.LoginRequest
	if err := decode(r, &req); err != nil {
		badRequest(w, r, err)
		return
	}
	res, err := ctl.svc.Login(r.Context(), req)
	if err != nil {
		fail(w, r, err)
		return
	}
	setTokenCookie(w, res.Token, 7*24*3600)
	OK(w, http.StatusOK, "Authentication successful.", res)
}

// Me handles GET /auth/me.
func (ctl *Controller) Me(w http.ResponseWriter, r *http.Request) {
	u, err := ctl.svc.Me(r.Context(), model.CallerFrom(r.Context()).UserID)
	if err != nil {
		fail(w, r, err)
		return
	}
	OK(w, http.StatusOK, "Profile retrieved successfully.", u)
}

// Logout handles POST /auth/logout.
func (ctl *Controller) Logout(w http.ResponseWriter, r *http.Request) {
	if err := ctl.svc.Logout(r.Context(), model.CallerFrom(r.Context())); err != nil {
		fail(w, r, err)
		return
	}
	setTokenCookie(w, "", -1)
	OK(w, http.StatusOK, "Logged out successfully.", nil)
}
