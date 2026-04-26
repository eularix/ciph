module github.com/Eularix/ciph/example/go

go 1.21

require (
	github.com/Eularix/ciph/modules/ciph-go/core v0.1.0
	github.com/Eularix/ciph/modules/ciph-go/middleware v0.1.0
)

require golang.org/x/crypto v0.17.0 // indirect

replace (
	github.com/Eularix/ciph/modules/ciph-go/core => ../../modules/ciph-go/core
	github.com/Eularix/ciph/modules/ciph-go/middleware => ../../modules/ciph-go/middleware
)
