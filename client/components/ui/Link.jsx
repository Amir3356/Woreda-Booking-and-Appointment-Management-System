import React from "react";
import { Link as RouterLink } from "react-router-dom";

const Link = React.forwardRef(function Link({ href, to, children, ...props }, ref) {
  const destination = to || href || "#";
  return (
    <RouterLink ref={ref} to={destination} {...props}>
      {children}
    </RouterLink>
  );
});

export default Link;
