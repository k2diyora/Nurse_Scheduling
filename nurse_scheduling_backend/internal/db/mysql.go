package db

import (
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func Connect(dsn string) (*gorm.DB, error) {
	return gorm.Open(mysql.Open(dsn), &gorm.Config{})
	//sample dsn = "user:password@tcp(127.0.0.1:3306)/nurse_db?parseTime=true"

}
