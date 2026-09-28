package main

import (
	"fmt"

	"golang.org/x/net/idna"
)

func main() {
	s, err := idna.ToASCII("bücher.example")
	fmt.Println(s, err)
}
