import { FavoriteController } from "@/controllers/FavoriteController";
import express from "express";

const router = express.Router();

router.get("/", FavoriteController.getFavorites);
router.get("/:id", FavoriteController.getFavoriteById);
router.post("/", FavoriteController.createFavorite);
router.delete("/:id", FavoriteController.deleteFavorite);
router.post("/delete-by-user-property", FavoriteController.deleteByUserAndProperty);
router.patch("/:id/restore", FavoriteController.restoreFavorite);
router.get("/user/:user_id", FavoriteController.getUserFavorites);
router.get("/check", FavoriteController.checkFavorite);

export default router;