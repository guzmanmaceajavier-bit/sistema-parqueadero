export const verificarRol = (...rolesPermitidos) => {

  return (req, res, next) => {

    try {

      const rolUsuario = req.usuario.rol;

      if (!rolesPermitidos.includes(rolUsuario)) {
        return res.status(403).json({
          ok: false,
          message: "No tienes permisos",
        });
      }

      next();

    } catch (error) {

      return res.status(500).json({
        ok: false,
        message: "Error verificando permisos",
      });

    }

  };

};