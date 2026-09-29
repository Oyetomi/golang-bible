package main

import (
	"fmt"
	"strings"

	"golang.org/x/net/html"
)

func main() {
	doc, err := html.Parse(strings.NewReader("<p>hello"))
	fmt.Println(doc != nil, err)
}
